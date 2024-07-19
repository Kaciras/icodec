import loadAVIF from "./lib/avif-enc.js";
import loadWebP from "./lib/webp-enc.js";
import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { test } from "node:test";
import * as assert from "assert";
import { join } from "path";

const rawBuffer = readFileSync("image.bin");
const snapshotDirectory = "snapshot";

mkdirSync(snapshotDirectory, { recursive: true });

test("AVIF encode", async () => {
	const wasmBinary = readFileSync("lib/avif-enc.wasm");
	const avifWasm = await loadAVIF({ wasmBinary });

	const AVIFTune = {
		Auto: 0,
		PSNR: 1,
		SSIM: 3,
	};

	const encoded = await avifWasm.encode(rawBuffer, 417, 114, {
		quality: 50,
		qualityAlpha: -1,
		denoiseLevel: 0,
		tileColsLog2: 0,
		tileRowsLog2: 0,
		speed: 6,
		subsample: 1,
		chromaDeltaQ: false,
		sharpness: 0,
		tune: AVIFTune.Auto,
		enableSharpYUV: false,
	})

	writeFileSync(join(snapshotDirectory, "image.avif"), encoded);
	assert.ok(encoded.length < 10 * 1024);
})


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
})
