import wasmFactoryEnc from "../dist/mozjpeg.js";
import { check, ImageDataLike, loadES, WasmSource } from "./common.js";

export enum ColorSpace {
	GRAYSCALE = 1,
	RGB,
	YCbCr,
}

// https://github.com/mozilla/mozjpeg/blob/6c9f0897afa1c2738d7222a0a9ab49e8b536a267/jcparam.c#L74
export enum Quantization {
	JPEG_Annex_K,
	Flat,
	MSSIM_Tuned_Kodak,
	ImageMagick,
	PSNR_HVS_M_Tuned_Kodak,
	Klein_Silverstein_Carney,
	Watson_Taylor_Borthwick,
	Ahumada_Watson_Peterson,
	Peterson_Ahumada_Watson,
}

export interface Options {
	/**
	 * Compression quality [0..100], 5-95 is most useful range.
	 *
	 * @default 75
	 */
	quality?: number;

	/**
	 * Create baseline JPEG file (disable progressive coding).
	 *
	 * @default false
	 */
	baseline?: boolean;

	/**
	 * Use arithmetic coding.
	 *
	 * @default false
	 */
	arithmetic?: boolean;

	/**
	 * Create progressive JPEG file.
	 *
	 * @default true
	 */
	progressive?: boolean;

	/**
	 * Optimize Huffman table (smaller file, but slow compression)
	 *
	 * @default true
	 */
	optimize_coding?: boolean;

	/**
	 * Smooth dithered input (N=1..100 is strength)
	 *
	 * @default 0
	 */
	smoothing?: number;

	/**
	 * @default ColorSpace.YCbCr
	 */
	color_space?: ColorSpace;

	/**
	 * Select the predefined quantization table to use.
	 *
	 * @default Quantization.ImageMagick
	 */
	quant_table?: Quantization;

	trellis_multipass?: boolean;
	trellis_opt_zero?: boolean;
	trellis_opt_table?: boolean;
	trellis_loops?: number;
	auto_subsample?: boolean;
	chroma_subsample?: number;
	separate_chroma_quality?: boolean;
	chroma_quality?: number;
}

export const defaultOptions: Required<Options> = {
	quality: 75,
	baseline: false,
	arithmetic: false,
	progressive: true,
	optimize_coding: true,
	smoothing: 0,
	color_space: ColorSpace.YCbCr,
	quant_table: Quantization.ImageMagick,
	trellis_multipass: false,
	trellis_opt_zero: false,
	trellis_opt_table: false,
	trellis_loops: 1,
	auto_subsample: true,
	chroma_subsample: 2,
	separate_chroma_quality: false,
	chroma_quality: 75,
};

export const mimeType = "image/jpeg";
export const extension = "jpg";

let codecWASM: any;

export async function loadEncoder(input?: WasmSource) {
	return codecWASM = await loadES(wasmFactoryEnc, input);
}

export const loadDecoder = loadEncoder;

export function encode(image: ImageDataLike, options?: Options) {
	options = { ...defaultOptions, ...options };
	const { data, width, height } = image;
	const result = codecWASM.encode(data, width, height, options);
	return check<Uint8Array>(result, "JPEG Encode");
}

export function decode(input: BufferSource) {
	return check<ImageData>(codecWASM.decode(input), "JPEG Decode");
}
