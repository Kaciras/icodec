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

function wrapLoader(original, e, d) {

	const loadEncoder = () => {
		const wasm = join(import.meta.dirname, "../dist", e);
		return original.loadEncoder(readFileSync(wasm));
	};

	const loadDecoder = () => {
		const wasm = join(import.meta.dirname, "../dist", d);
		return original.loadDecoder(readFileSync(wasm));
	};

	return { ...original, loadEncoder, loadDecoder };
}

export const avif = wrapLoader(avifRaw, "avif-enc.wasm", "avif-dec.wasm");
export const png = wrapLoader(pngRaw, "png_bg.wasm");
export const jpeg = wrapLoader(jpegRaw, "jpeg-enc.wasm");
export const jxl = wrapLoader(jxlRaw, "jxl-enc.wasm", "jxl-dec.wasm");
export const webp = wrapLoader(webpRaw, "webp-enc.wasm", "webp-dec.wasm");
export const qoi = wrapLoader(qoiRaw, "qoi.wasm", "qoi.wasm");
export const wp2 = wrapLoader(wp2Raw, "wp2-enc.wasm", "wp2-dec.wasm");
