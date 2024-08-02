import { readFileSync } from "fs";
import { join } from "path";

import * as avifRaw from "./avif.js";
import * as pngRaw from "./png.js";
import * as jpegRaw from "./jpeg.js";
import * as jxlRaw from "./jxl.js";
import * as webpRaw from "./webp.js";
import * as qoiRaw from "./qoi.js";
import * as wp2Raw from "./wp2.js";

/**
 * Node does not have `ImageData` class, so we define a pure version.
 */
export class PureImageData {

	constructor(data, width, height) {
		this.data = data;
		this.width = width;
		this.height = height;
	}
}

PureImageData.prototype.colorSpace = "srgb";

globalThis._ICodec_ImageData = globalThis.ImageData ?? PureImageData;

function wrapLoaders(original, e, d) {

	const loadEncoder = (input) => {
		input ??= join(import.meta.dirname, "../dist", e);
		if (typeof input === "string") {
			input = readFileSync(input);
		}
		return original.loadEncoder(input);
	};

	const loadDecoder = (input) => {
		input ??= join(import.meta.dirname, "../dist", d);
		if (typeof input === "string") {
			input = readFileSync(input);
		}
		return original.loadDecoder(input);
	};

	return { ...original, loadEncoder, loadDecoder };
}

export const avif = wrapLoaders(avifRaw, "avif-enc.wasm", "avif-dec.wasm");
export const png = wrapLoaders(pngRaw, "png_bg.wasm");
export const jpeg = wrapLoaders(jpegRaw, "jpeg-enc.wasm");
export const jxl = wrapLoaders(jxlRaw, "jxl-enc.wasm", "jxl-dec.wasm");
export const webp = wrapLoaders(webpRaw, "webp-enc.wasm", "webp-dec.wasm");
export const qoi = wrapLoaders(qoiRaw, "qoi.wasm", "qoi.wasm");
export const wp2 = wrapLoaders(wp2Raw, "wp2-enc.wasm", "wp2-dec.wasm");
