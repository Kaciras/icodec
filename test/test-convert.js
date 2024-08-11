import { describe, test } from "node:test";
import * as assert from "assert";
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

async function testDecode() {
	const input = getSnapshot("image", this);
	const { loadDecoder, decode } = this;

	await loadDecoder();
	const output = decode(input);

	assertSimilar(getRawPixels("image"), output, 0.01, 0.2);
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
