import wasmFactory, { optimize, png_to_rgba, quantize } from "../dist/pngquant.js";
import { ImageDataLike, toBitDepth, WasmSource } from "./common.js";

export interface QuantizeOptions {
	/**
	 * Range: [1, 10], bigger is faster and generate images of lower quality,
	 * but may be useful for real-time generation of images.
	 *
	 * @default 4
	 */
	speed?: number;

	/**
	 * Range [0, 100], roughly like JPEG. the max 100 means best effort
	 * If less than 100, the library will try to use fewer colors.
	 *
	 * Images with fewer colors are not always smaller, due to increased dithering it causes.
	 *
	 * @default 75
	 */
	quality?: number;

	/**
	 * Limit the number of colors in palette, range: [2, 256].
	 *
	 * @default 256
	 */
	colors?: number;

	/**
	 * Range [0, 1] float, set to 1 to get nice smooth image.
	 *
	 * @default 1
	 */
	dithering?: number;
}

export interface Options extends QuantizeOptions {
	/**
	 * Range [0, 6], bigger means smallest file and slower compression.
	 *
	 * @default 3
	 */
	level?: number;

	/**
	 * Is the image made to support progressive loading?
	 * Enabling this feature will increase the size of the results.
	 *
	 * @default false
	 */
	interlace?: boolean;

	/**
	 * Lossy compress the image to PNG for significant file size reduction.
	 * Implements the same functionality as [pngquant](https://pngquant.org)
	 *
	 * if set to false, properties from `QuantizeOptions` are ignored.
	 *
	 * @default true
	 */
	quantize?: boolean;

	/** @internal */
	bit_depth?: number;
}

export const defaultOptions: Required<Options> = {
	speed: 4,
	quality: 75,
	colors: 256,
	dithering: 1,
	level: 3,
	interlace: false,
	quantize: true,

	bit_depth: 8,
};

export const bitDepth = [8, 16];
export const mimeType = "image/png";
export const extension = "png";

export const loadEncoder = (module_or_path?: WasmSource) => wasmFactory({ module_or_path });
export const loadDecoder = loadEncoder;

/**
 * Reduces the colors used in the image at a slight loss, using a combination
 * of vector quantization algorithms.
 *
 * Can be used before other compression algorithm to boost compression ratio.
 */
export function reduceColors(image: ImageDataLike, options?: QuantizeOptions) {
	options = { ...defaultOptions, ...options };
	const { data, width, height } = toBitDepth(image, 8);
	return quantize(data as Uint8Array, width, height, { ...defaultOptions, ...options });
}

export function encode(image: ImageDataLike, options?: Options) {
	options = { ...defaultOptions, ...options };
	if (options.quantize) {
		image = toBitDepth(image, 8);
	}
	const { data, width, height, depth } = image;
	options.bit_depth = depth;
	return optimize(data as Uint8Array, width, height, { ...defaultOptions, ...options });
}

export function decode(input: Uint8Array) {
	const [data, width, depth] = png_to_rgba(input);
	let height = data.byteLength / width / 4;
	if (depth === 16) {
		height /= 2;
	}
	return _icodec_ImageData(data, width, height, depth);
}
