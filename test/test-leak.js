import { describe, test } from "node:test";
import { avif, heic, jpeg, jxl, png, qoi, webp, wp2 } from "../lib/node.js";
import assert from "assert";
import { getRawPixels, getSnapshot } from "./fixtures.js";

// Run functions repeatedly, check if memory usage grows.
const runs = 60;

function getMemoryBuffer(wasm) {
	return (wasm.HEAP8 ?? wasm.memory).buffer;
}

async function testEncodeLeak() {
	const { loadEncoder, encode } = this;
	const image = getRawPixels("image");

	const wasm = await loadEncoder();
	encode(image); // Ensure memory grown.

	const memory = getMemoryBuffer(wasm);
	const before = memory.byteLength;

	for (let i = 0; i < runs; i++) {
		encode(image);
	}
	const after = memory.byteLength;
	assert.strictEqual(after, before);
}

async function testDecodeLeak() {
	const { loadDecoder, decode } = this;
	const input = getSnapshot("image", this);

	const wasm = await loadDecoder();
	decode(input); // Ensure memory grown.

	const memory = getMemoryBuffer(wasm);
	const before = memory.byteLength;

	for (let i = 0; i < runs; i++) {
		decode(input);
	}
	const after = memory.byteLength;
	assert.strictEqual(after, before);
}

describe("encode", () => {
	test("JPEG", testEncodeLeak.bind(jpeg));
	test("PNG", testEncodeLeak.bind(png));
	test("QOI", testEncodeLeak.bind(qoi));
	test("WebP", testEncodeLeak.bind(webp));
	test("AVIF", testEncodeLeak.bind(avif));
	test("JXL", testEncodeLeak.bind(jxl));
	test("WebP2", testEncodeLeak.bind(wp2));
});

describe("decode", () => {
	test("JPEG", testDecodeLeak.bind(jpeg));
	test("PNG", testDecodeLeak.bind(png));
	test("QOI", testDecodeLeak.bind(qoi));
	test("WebP", testDecodeLeak.bind(webp));
	test("HEIC", testDecodeLeak.bind(heic));
	test("AVIF", testDecodeLeak.bind(avif));
	test("JXL", testDecodeLeak.bind(jxl));
	test("WebP2", testDecodeLeak.bind(wp2));
});
