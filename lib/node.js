import { readFileSync } from "node:fs";
import { join } from "node:path";

import { PureImageData } from "./common.js";

import * as avifRaw from "./avif.js";
import * as pngRaw from "./png.js";
import * as jpegRaw from "./jpeg.js";
import * as jxlRaw from "./jxl.js";
import * as webpRaw from "./webp.js";
import * as heicRaw from "./heic.js";
import * as qoiRaw from "./qoi.js";
import * as wp2Raw from "./wp2.js";

globalThis._icodec_ImageData = (data, w, h, depth) => {
	return new PureImageData(data, w, h, depth);
};

function wrapLoaders(original, e, d = e) {
	let loadedEnc;
	let loadedDec;

	const loadEncoder = input => {
		if (loadedEnc) return loadedEnc;

		input ??= join(import.meta.dirname, "../dist", e);
		if (typeof input === "string") {
			input = readFileSync(input);
		}
		return loadedEnc = original.loadEncoder(input);
	};

	const loadDecoder = input => {
		if (loadedDec) return loadedDec;

		input ??= join(import.meta.dirname, "../dist", d);
		if (typeof input === "string") {
			input = readFileSync(input);
		}
		return loadedDec = original.loadDecoder(input);
	};

	return { ...original, loadEncoder, loadDecoder };
}

export const avif = wrapLoaders(avifRaw, "avif-enc.wasm", "avif-dec.wasm");
export const png = wrapLoaders(pngRaw, "pngquant_bg.wasm");
export const jpeg = wrapLoaders(jpegRaw, "mozjpeg.wasm");
export const jxl = wrapLoaders(jxlRaw, "jxl-enc.wasm", "jxl-dec.wasm");
export const webp = wrapLoaders(webpRaw, "webp-enc.wasm", "webp-dec.wasm");
export const qoi = wrapLoaders(qoiRaw, "qoi.wasm");
export const wp2 = wrapLoaders(wp2Raw, "wp2-enc.wasm", "wp2-dec.wasm");

/*
 * Web Workers that require special handling of Node, but if we add "node" to build target,
 * it will require the bundler to add additional config to exclude node modules.
 */
export const heic = wrapLoaders(heicRaw, null, "heic-dec.wasm");
