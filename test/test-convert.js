import { readFileSync, writeFileSync } from "fs";
import { describe, test } from "node:test";
import * as assert from "assert";
import { join } from "path";
import pixelMatch from "pixelmatch";
import { avif, heic, jpeg, jxl, png, qoi, webp, wp2 } from "../lib/node.js";

const snapshotDirectory = "test/snapshot";

const rgbaFixture = {
	width: 417,
	height: 114,
	data: readFileSync("test/snapshot/image.bin"),
};

function assertImageEqual(buffer1, { width, height, data }) {
	assert.strictEqual(buffer1.byteLength, data.byteLength);

	const diff = new Uint8ClampedArray(width * height * 4);
	const diffs = pixelMatch(buffer1, data, diff, width, height, { threshold: 0.2 });
	assert.ok(diffs < width * height / 100, "Wrong decode output");
}

async function testEncode() {
	const { loadEncoder, extension, encode } = this;
	await loadEncoder();
	const encoded = encode(rgbaFixture);
	writeFileSync(join(snapshotDirectory, "image." + extension), encoded);
	assert.ok(encoded.length < 18 * 1024);
}

async function testDecode() {
	const { loadDecoder, extension, decode } = this;
	await loadDecoder();
	const output = decode(readFileSync("test/snapshot/image." + extension));
	assertImageEqual(output.data, rgbaFixture);
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
