import { readFileSync, writeFileSync } from "fs";
import { describe, test } from "node:test";
import * as assert from "assert";
import { join } from "path";
import pixelMatch from "pixelmatch";
import { avif, jpeg, jxl, png, qoi, webp, wp2 } from "../lib/node.js";

const rawBuffer = readFileSync("test/snapshot/image.bin");
const snapshotDirectory = "test/snapshot";

const w = 417;
const h = 114;

function assertImageEqual(buffer1, buffer2) {
	assert.strictEqual(buffer1.byteLength, buffer2.byteLength);
	const diff = new Uint8ClampedArray(w * h * 4);
	const diffs = pixelMatch(buffer1, buffer2, diff, w, h, { threshold: 0.2 });
	assert.ok(diffs < w * h / 100, "Wrong decode output");
}

async function testEncode() {
	const { loadEncoder, extension, encode } = this;
	await loadEncoder();
	const encoded = encode(rawBuffer, 417, 114);
	writeFileSync(join(snapshotDirectory, "image." + extension), encoded);
	assert.ok(encoded.length < 18 * 1024);
}

async function testDecode() {
	const { loadDecoder, extension, decode } = this;
	await loadDecoder();
	const image = decode(readFileSync("test/snapshot/image." + extension));
	assertImageEqual(image.data, rawBuffer);
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
	test("QOI", testDecode.bind(qoi));
	test("WebP", testDecode.bind(webp));
	test("AVIF", testDecode.bind(avif));
	test("JXL", testDecode.bind(jxl));
	test("WebP2", testDecode.bind(wp2));
});
