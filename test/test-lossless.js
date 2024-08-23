import { test } from "node:test";
import { avif, jxl, png, qoi, webp, wp2 } from "../lib/node.js";
import { assertSimilar, getRawPixels } from "./fixtures.js";

const image = getRawPixels("alpha");

async function testLossless(options) {
	const { loadEncoder, encode, loadDecoder, decode } = this;
	await loadEncoder();
	await loadDecoder();

	const back = decode(encode(image, options));

	assertSimilar(image, back, 0, 0);
}

test("AVIF", testLossless.bind(avif, {
	quality: 100,
	subsample: avif.Subsampling.YUV444,
}));
test("WebP", testLossless.bind(webp, { lossless: true }));
test("PNG", testLossless.bind(png, { quantize: false }));
test("QOI", testLossless.bind(qoi));
test("JXL", testLossless.bind(jxl, { lossless: true }));
test("WebP2", testLossless.bind(wp2, { quality: 100 }));
