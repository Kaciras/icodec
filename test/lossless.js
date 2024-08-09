import { readFileSync } from "fs";
import assert from "assert";
import { test } from "node:test";
import { avif, jxl, png, qoi, webp } from "../lib/node.js";
import sharp from "sharp";
import pixelMatch from "pixelmatch";

const data = readFileSync("test/snapshot/alpha.bin");
const width = 101;
const height = 101;

async function testLossless(options) {
	const { loadEncoder, encode, loadDecoder, decode } = this;

	await loadEncoder();
	const encoded = encode({ data, width, height }, options);

	const back = this === png
		? await sharp(encoded).raw().toBuffer()
		: await loadDecoder().then(() => decode(encoded).data);

	const differences = pixelMatch(data, back, null, width, height, { threshold: 0 });
	assert.equal(differences, 0);
}

test("AVIF", testLossless.bind(avif, {
	quality: 100,
	subsample: avif.Subsampling.YUV444,
}));
test("WebP", testLossless.bind(webp, { lossless: true }));
test("PNG", testLossless.bind(png, { quantize: false }));
test("QOI", testLossless.bind(qoi));
test("JXL", testLossless.bind(jxl, { lossless: true }));

// test("WebP2", testLossless.bind(wp2, { quality: 100 }));
