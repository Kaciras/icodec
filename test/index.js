import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { test } from "node:test";
import * as assert from "assert";
import { join } from "path";
import * as jpeg from "../lib/jpeg.js";
import * as png from "../lib/png.js";
import * as webp from "../lib/webp.js";
import * as avif from "../lib/avif.js";

const rawBuffer = readFileSync("test/image.bin");
const snapshotDirectory = "test/snapshot";

mkdirSync(snapshotDirectory, { recursive: true });

test("JPEG encode", async () => {
	await jpeg.initialize();

	const encoded = await jpeg.encode(rawBuffer, 417, 114, {});

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

	const encoded = await webp.encode(rawBuffer, 417, 114, {});

	writeFileSync(join(snapshotDirectory, "image.webp"), encoded);
	assert.ok(encoded.length < 7 * 1024);
});

test("AVIF encode", async () => {
	await avif.initialize();

	const encoded = await avif.encode(rawBuffer, 417, 114, {});

	writeFileSync(join(snapshotDirectory, "image.avif"), encoded);
	assert.ok(encoded.length < 7 * 1024);
});
