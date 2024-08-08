import { ImageDataLike, WasmSource } from "./common.js";

export * as avif from "./avif.js";
export * as png from "./png.js";
export * as jpeg from "./jpeg.js";
export * as jxl from "./jxl.js";
export * as webp from "./webp.js";
export * as heic from "./heic.js";
export * as qoi from "./qoi.js";
export * as wp2 from "./wp2.js";

declare global {
	// eslint-disable-next-line no-var
	var _ICodec_ImageData: typeof ImageData;
}

globalThis._ICodec_ImageData = ImageData;

/**
 * Provides a uniform type for codec modules that support encoding.
 *
 * @example
 * import { wp2, ICodecModule } from "icodec";
 *
 * const encoder: ICodecModule<wp2.Options> = wp2;
 */
export interface ICodecModule<T = any> {

	defaultOptions: Required<T>;
	mimeType: string;
	extension: string;

	loadDecoder(source?: WasmSource): Promise<any>;

	decode(input: Uint8Array): ImageData;

	loadEncoder(source?: WasmSource): Promise<any>;

	encode(image: ImageDataLike, options?: T): Uint8Array;
}
