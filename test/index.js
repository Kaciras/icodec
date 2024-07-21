import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { test } from "node:test";
import * as assert from "assert";
import { join } from "path";
import { encode, initialize } from "../lib/png.js";

const rawBuffer = readFileSync("test/image.bin");
const snapshotDirectory = "test/snapshot";

mkdirSync(snapshotDirectory, { recursive: true });

test("PNG encode", async () => {
	await initialize();
	const encoded = encode(rawBuffer, 417, 114, {});
	writeFileSync(join(snapshotDirectory, "image.png"), encoded);
	assert.ok(encoded.length < 7 * 1024);
});

test("WebP encode", async () => {
	const wasmBinary = readFileSync("lib/webp-enc.wasm");
	const webpWasm = await loadWebP({ wasmBinary });

	const encoded = await webpWasm.encode(rawBuffer, 417, 114, {
		quality: 75,
		target_size: 0,
		target_PSNR: 0,
		method: 4,
		sns_strength: 50,
		filter_strength: 60,
		filter_sharpness: 0,
		filter_type: 1,
		partitions: 0,
		segments: 4,
		pass: 1,
		show_compressed: 0,
		preprocessing: 0,
		autofilter: 0,
		partition_limit: 0,
		alpha_compression: 1,
		alpha_filtering: 1,
		alpha_quality: 100,
		lossless: 1,
		exact: 0,
		image_hint: 0,
		emulate_jpeg_size: 0,
		thread_level: 0,
		low_memory: 0,
		near_lossless: 100,
		use_delta_palette: 0,
		use_sharp_yuv: 0,
	});

	writeFileSync(join(snapshotDirectory, "image.webp"), encoded);
	assert.ok(encoded.length < 7 * 1024);
});
