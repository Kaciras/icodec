import { describe, test } from "node:test";
import * as assert from "node:assert";
import sharp from "sharp";
import { avif, heic, jpeg, jxl, png, qoi, webp, wp2 } from "../lib/node.js";
import { assertSimilar, generateTestImage, getRawPixels, getSnapshot, updateSnapshot } from "./fixtures.js";

async function testEncode(image, options) {
	const { loadEncoder, encode } = this;
	await loadEncoder();
	const encoded = encode(image, options);

	updateSnapshot(`square16_${image.depth}bit`, this, encoded);
}

describe("encode 8bit", () => {
	const image = generateTestImage(8);

	test("JPEG", testEncode.bind(jpeg, image));
	test("PNG", testEncode.bind(png, image));
	test("QOI", testEncode.bind(qoi, image));
	test("WebP", testEncode.bind(webp, image));
	test("AVIF", testEncode.bind(avif, image));
	test("JXL", testEncode.bind(jxl, image, { lossless: true }));
	test("WebP2", testEncode.bind(wp2, image));
});

describe("encode 10bit", () => {
	const image = generateTestImage(10);

	test("AVIF", testEncode.bind(avif, image));
	test("JXL", testEncode.bind(jxl, image));
});

describe("encode 12bit", () => {
	const image = generateTestImage(12);

	test("AVIF", testEncode.bind(avif, image));
	test("JXL", testEncode.bind(jxl, image, { lossless: true }));
});

describe("encode 16bit", () => {
	const image = generateTestImage(16);

	test("AVIF", testEncode.bind(avif, image));
	test("JXL", testEncode.bind(jxl, image));
	test("PNG", testEncode.bind(png, image, { quantize: false }));
});

async function testDecode(image) {
	const snapshot = getSnapshot(`square16_${image.depth}bit`, this);
	const { loadDecoder, decode } = this;
	await loadDecoder();
	const output = decode(snapshot);

	if (loadDecoder === jpeg.loadDecoder) {
		const opacity = image.data.slice();
		for (let i = 3; i < opacity.length ;i+=4) {
			opacity[i] = 255;
		}
		image = _icodec_ImageData(opacity, image.width, image.height, 8);
	}

	assert.strictEqual(output.depth, image.depth);
	assertSimilar(image, output, 0.2, 0.01);
}

describe("decode 8bit", () => {
	const image = generateTestImage(8);

	test("JPEG", testDecode.bind(jpeg, image));
	test("PNG", testDecode.bind(png, image));
	test("QOI", testDecode.bind(qoi, image));
	test("WebP", testDecode.bind(webp, image));
	test("HEIC", testDecode.bind(heic, image));
	test("AVIF", testDecode.bind(avif, image));
	test("JXL", testDecode.bind(jxl, image));
	test("WebP2", testDecode.bind(wp2, image));
});

describe("decode 12bit", () => {
	const image = generateTestImage(12);

	test("HEIC", testDecode.bind(heic, image));
	test("AVIF", testDecode.bind(avif, image));
	test("JXL", testDecode.bind(jxl, image));
});

describe("decode 16bit", () => {
	const image = generateTestImage(16);

	test("PNG", testDecode.bind(png, image));
	test("AVIF", testDecode.bind(avif, image));
	test("JXL", testDecode.bind(jxl, image));
});

test("decode gray PNG", async () => {
	const buffer = getSnapshot("4bitGray", png);

	await png.loadDecoder();
	const image = png.decode(buffer);

	const data = await sharp(buffer).ensureAlpha().raw().toBuffer();
	const expected = { data, width: 150, height: 200 };
	assertSimilar(expected, image, 0, 0);
});

async function testDecodeBroken() {
	const image = getRawPixels("image");
	const { loadDecoder, decode } = this;

	await loadDecoder();
	assert.throws(() => decode(image.data));
}

describe("decode broken", () => {
	test("JPEG", testDecodeBroken.bind(jpeg));
	test("PNG", testDecodeBroken.bind(png));
	test("QOI", testDecodeBroken.bind(qoi));
	test("WebP", testDecodeBroken.bind(webp));
	test("HEIC", testDecodeBroken.bind(heic));
	test("AVIF", testDecodeBroken.bind(avif));
	test("JXL", testDecodeBroken.bind(jxl));
	test("WebP2", testDecodeBroken.bind(wp2));
});
