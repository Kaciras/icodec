import wasmFactory, { optimize, quantize } from "../dist/png.js";
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

export interface Options extends QuantizeOptions {
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

	/**
	 * Lossy compress the image to PNG for significant file size reduction.
	 * Implements the same functionality as [pngquant](https://pngquant.org)
	 *
	 * if set to false, properties from `QuantizeOptions` are ignored.
	 *
	 * @default true
	 */
	quantize: boolean;
}

export const defaultOptions: Options = {
	speed: 4,
	quality: 75,
	min_quality: 0,
	dithering: 1,
	level: 3,
	interlace: false,
	quantize: true,
};

export const mimeType = "image/png";
export const extension = "png";

export const loadEncoder = wasmFactory as (input?: WasmSource) => Promise<void>;

/**
 * Reduces the colors used in the image at a slight loss,
 * using a combination of vector quantization algorithms.
 */
export function reduceColors(data: Uint8Array, width: number, height: number, options?: QuantizeOptions) {
	return quantize(data, width, height, { ...defaultOptions, ...options });
}

/**
 * Encode the RGBA buffer to PNG format, with optional lossy compression.
 */
export function encode(data: Uint8Array, width: number, height: number, options?: Options) {
	return optimize(data, width, height, { ...defaultOptions, ...options });
}
