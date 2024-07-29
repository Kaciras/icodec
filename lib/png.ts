import wasmFactory, { png_encode, quantize, quantize_to_png } from "../dist/png.js";
import { WasmSource } from "./common.js";

export interface QuantizeOptions {
	/**
	 * Range: [0, 10], bigger is faster and generate images of lower quality,
	 * but may be useful for real-time generation of images.
	 *
	 * @default 4
	 */
	speed: number;

	/**
	 * Range [0, 100], roughly like JPEG. the max 100 means best effort
	 * If less than 100, the library will try to use fewer colors.
	 *
	 * Images with fewer colors are not always smaller, due to increased dithering it causes.
	 *
	 * @default 75
	 */
	quality: number;

	/**
	 * If the minimum quality can't be met, the quantization will be aborted with an error.
	 * Default is 0, which means never aborts the process.
	 *
	 * @default 0
	 */
	min_quality: number;

	/**
	 * Range [0, 1] float, set to 1 to get nice smooth image.
	 *
	 * @default 1
	 */
	dithering: number;
}

export interface EncodeOptions {
	/**
	 * Range [0, 6], bigger means smallest file and slower compression.
	 *
	 * @default 3
	 */
	level: number;

	/**
	 * Is the image made to support progressive loading?
	 * Enabling this feature will increase the size of the results.
	 *
	 * @default false
	 */
	interlace: boolean;
}

export type Options = EncodeOptions & QuantizeOptions;

export const defaultOptions: Options = {
	speed: 4,
	quality: 75,
	min_quality: 0,
	dithering: 1,
	level: 3,
	interlace: false,
};

export const mimeType = "image/png";
export const extension = "png";

export const loadEncoder = wasmFactory as (input?: WasmSource) => Promise<void>;

/**
 * Reduces the colors used in the image at a slight loss,
 * using a combination of vector quantization algorithms.
 */
export function reduceColors(data: any, width: number, height: number, options?: QuantizeOptions) {
	return quantize(data, width, height, { ...defaultOptions, ...options });
}

/**
 * Encode the RGBA buffer to PNG format, this is a lossless operation.
 */
export function encode(data: any, width: number, height: number, options?: EncodeOptions) {
	return png_encode(data, width, height, { ...defaultOptions, ...options });
}

/**
 * Lossy compress the image to PNG for significant file size reduction.
 *
 * This function implements the same functionality as [pngquant](https://pngquant.org).
 */
export function optimize(data: any, width: number, height: number, options?: Options) {
	return quantize_to_png(data, width, height, { ...defaultOptions, ...options });
}
