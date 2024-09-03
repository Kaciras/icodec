import { describe, test } from "node:test";
import * as assert from "node:assert";
import sharp from "sharp";
import { avif, heic, jpeg, jxl, png, qoi, webp, wp2 } from "../lib/node.js";
import { assertSimilar, getRawPixels, getSnapshot, updateSnapshot } from "./fixtures.js";

async function testEncode() {
	const { loadEncoder, encode } = this;
	await loadEncoder();
	const encoded = encode(getRawPixels("image"));

	updateSnapshot("image", this, encoded);
	assert.ok(encoded.length < 18 * 1024);
}

describe("encode", () => {
	test("JPEG", testEncode.bind(jpeg));
	test("PNG", testEncode.bind(png));
	test("QOI", testEncode.bind(qoi));
	test("WebP", testEncode.bind(webp));
	test("AVIF", testEncode.bind(avif));
	test("JXL", testEncode.bind(jxl));
	test("WebP2", testEncode.bind(wp2));
});

async function testDecode() {
	const { loadDecoder, decode } = this;
	await loadDecoder();
	const output = decode(getSnapshot("image", this));

	assertSimilar(getRawPixels("image"), output, 0.2, 0.01);
}

describe("decode", () => {
	test("JPEG", testDecode.bind(jpeg));
	test("PNG", testDecode.bind(png));
	test("QOI", testDecode.bind(qoi));
	test("WebP", testDecode.bind(webp));
	test("HEIC", testDecode.bind(heic));
	test("AVIF", testDecode.bind(avif));
	test("JXL", testDecode.bind(jxl));
	test("WebP2", testDecode.bind(wp2));
});

test("decode gray PNG", async () => {
	const buffer = getSnapshot("4bitGray", png);

	await png.loadDecoder();
	const image = png.decode(buffer);

	const data = await sharp(buffer).ensureAlpha().raw().toBuffer();
	const expected = { data, width: 150, height: 200 };
	assertSimilar(expected, image, 0, 0);
});

test("decode 16bit PNG", async () => {
	const buffer = getSnapshot("16bit", png);

	await png.loadDecoder();
	const image = png.decode(buffer).to8BitDepth();

	const data = await sharp(buffer).ensureAlpha().raw().toBuffer();
	const expected = { data, width: 32, height: 32 };
	assertSimilar(expected, image, 0, 0);
});

test("AVIF decode 12 bit", async () => {
	const buffer = getSnapshot("12bit", avif);
	await avif.loadDecoder();
	const image = avif.decode(buffer);

	// Can't find the correct pixels of this image, the result decode by browser
	// is different from our decoder, so we allow a small amount of difference.
	const expected = getRawPixels("12bit");
	assertSimilar(expected, image, 0.1, 0);
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
