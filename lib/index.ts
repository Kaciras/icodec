export * as avif from "./avif.js";
export * as png from "./png.js";
export * as jpeg from "./jpeg.js";
export * as jxl from "./jxl.js";
export * as webp from "./webp.js";
export * as qoi from "./qoi.js";
export * as wp2 from "./wp2.js";

declare global {
	// eslint-disable-next-line no-var
	var _ICodec_ImageData: typeof ImageData;
}

globalThis._ICodec_ImageData = ImageData;
