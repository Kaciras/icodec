import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { test } from "node:test";
import * as assert from "assert";
import { join } from "path";
import pixelMatch from "pixelmatch";
import * as jpeg from "../lib/jpeg.js";
import * as png from "../lib/png.js";
import * as webp from "../lib/webp.js";
import * as avif from "../lib/avif.js";
import * as qoi from "../lib/qoi.js";

const rawBuffer = readFileSync("test/image.bin");
const snapshotDirectory = "test/snapshot";

const w = 417;
const h = 114;

mkdirSync(snapshotDirectory, { recursive: true });

function assertImageEquals(buffer1, buffer2) {
	assert.strictEqual(buffer1.byteLength, buffer2.byteLength);
	const diff = new Uint8ClampedArray(w * h * 4);
	pixelMatch(buffer1, buffer2, diff, w, h, { threshold: 0.1 });
}

test("JPEG encode", async () => {
	await jpeg.initialize();

	const encoded = jpeg.encode(rawBuffer, 417, 114, {});

	writeFileSync(join(snapshotDirectory, "image.jpeg"), encoded);
	assert.ok(encoded.length < 7 * 1024);
});

test("PNG encode", async () => {
	await png.initialize();
	const encoded = png.optimize(rawBuffer, 417, 114, {});
	writeFileSync(join(snapshotDirectory, "image.png"), encoded);
	assert.ok(encoded.length < 7 * 1024);
});

test("WebP encode", async () => {
	await webp.initialize();

	const encoded = webp.encode(rawBuffer, 417, 114, {});

	writeFileSync(join(snapshotDirectory, "image.webp"), encoded);
	assert.ok(encoded.length < 7 * 1024);
});

test("WebP decode", async () => {
	await webp.initialize();

	const image = webp.decode(readFileSync("test/snapshot/image.webp"));

	assertImageEquals(image.data, rawBuffer);
});

test("AVIF encode", async () => {
	await avif.initialize();

	const encoded = avif.encode(rawBuffer, 417, 114, {});

	writeFileSync(join(snapshotDirectory, "image.avif"), encoded);
	assert.ok(encoded.length < 7 * 1024);
});

test("AVIF decode", async () => {
	await avif.initialize();

	const image = avif.decode(readFileSync("test/snapshot/image.avif"));

	assertImageEquals(image.data, rawBuffer);
});

test("QOI encode", async () => {
	await qoi.initialize();

	const encoded = qoi.encode(rawBuffer, 417, 114, {});

	writeFileSync(join(snapshotDirectory, "image.qoi"), encoded);
	assert.ok(encoded.length < 18 * 1024);
});

test("QOI decode", async () => {
	await qoi.initialize();
	const image = qoi.decode(readFileSync("test/snapshot/image.qoi"));
	assertImageEquals(image.data, rawBuffer);
});
