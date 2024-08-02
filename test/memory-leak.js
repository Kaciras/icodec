import { describe, test } from "node:test";
import { avif, jpeg, jxl, png, qoi, webp, wp2 } from "../lib/node.js";
import assert from "assert";
import { readFileSync } from "fs";

const rawBuffer = readFileSync("test/snapshot/image.bin");

const leakTestRuns = 20;

function getMemoryBuffer(wasm) {
	return (wasm.HEAP8 ?? wasm.memory).buffer;
}

async function testEncodeLeak() {
	const { loadEncoder, encode } = this;
	const wasm = await loadEncoder();
	encode(rawBuffer, 417, 114);

	const memory = getMemoryBuffer(wasm);
	const before = memory.byteLength;

	for (let i = 0; i < leakTestRuns; i++) {
		encode(rawBuffer, 417, 114);
	}
	const after = memory.byteLength;
	assert.strictEqual(after, before);
}

async function testDecodeLeak() {
	const { loadDecoder, extension, decode } = this;
	const wasm = await loadDecoder();
	const file = readFileSync("test/snapshot/image." + extension);
	decode(file);

	const memory = getMemoryBuffer(wasm);
	const before = memory.byteLength;

	for (let i = 0; i < leakTestRuns; i++) {
		decode(file);
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
	test("QOI", testDecodeLeak.bind(qoi));
	test("WebP", testDecodeLeak.bind(webp));
	test("AVIF", testDecodeLeak.bind(avif));
	test("JXL", testDecodeLeak.bind(jxl));
	test("WebP2", testDecodeLeak.bind(wp2));
});
