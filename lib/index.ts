import { ImageDataLike, PureImageData, toBitDepth, WasmSource } from "./common.js";

export { ImageDataLike, toBitDepth };

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
	var _icodec_ImageData: (data: Uint8ClampedArray, w: number, h: number, depth: number) => ImageDataLike;
}

globalThis._icodec_ImageData = (data, w, h, depth) => {
	if (depth === 8) {
		return new ImageDataEx(data, w, h);
	}
	return new PureImageData(data, w, h, depth);
};

class ImageDataEx extends ImageData implements ImageDataLike {

	readonly depth = 8;
}

/**
 * Provides a uniform type for codec modules that support encoding.
 *
 * @example
 * import { wp2, ICodecModule } from "icodec";
 *
 * const encoder: ICodecModule<wp2.Options> = wp2;
 */
export interface ICodecModule<T = any> {
	/**
	 * The default options of `encode` function.
	 */
	defaultOptions: Required<T>;

	/**
	 * The MIME type string of the format.
	 */
	mimeType: string;

	/**
	 * File extension (without the dot) of this format.
	 */
	extension: string;

	/**
	 * List of supported bit depth, from lower to higher.
	 */
	bitDepth: number[];

	/**
	 * Load the decoder WASM file, must be called once before decode.
	 * Multiple calls are ignored, and return the first result.
	 *
	 * @param source If pass a string, it's the URL of WASM file to fetch,
	 *               else it will be treated as the WASM bytes.
	 * @return the underlying WASM module, which is not part of
	 *               the public API and can be changed at any time.
	 */
	loadDecoder(source?: WasmSource): Promise<any>;

	/**
	 * Convert the image to raw RGBA data.
	 */
	decode(input: Uint8Array): ImageData;

	/**
	 * Load the encoder WASM file, must be called once before encode.
	 * Multiple calls are ignored, and return the first result.
	 *
	 * @param source If pass a string, it's the URL of WASM file to fetch,
	 *               else it will be treated as the WASM bytes.
	 * @return the underlying WASM module, which is not part of
	 *               the public API and can be changed at any time.
	 */
	loadEncoder(source?: WasmSource): Promise<any>;

	/**
	 * Encode an image with RGBA pixels data.
	 */
	encode(image: ImageDataLike, options?: T): Uint8Array;
}
