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
	optimizeCoding?: boolean;

	/**
	 * Smooth dithered input (N=1..100 is strength)
	 *
	 * @default 0
	 */
	smoothing?: number;

	/**
	 * @default ColorSpace.YCbCr
	 */
	colorSpace?: ColorSpace;

	/**
	 * Select the predefined quantization table to use.
	 *
	 * @default Quantization.ImageMagick
	 */
	quantTable?: Quantization;

	/**
	 * use scans in trellis optimization.
	 *
	 * @default false
	 */
	trellisMultipass?: boolean;

	/**
	 * optimize for sequences of EOB
	 */
	trellisOptZero?: boolean;

	/**
	 * optimize quant table in trellis loop.
	 *
	 * @default false
	 */
	trellisOptTable?: boolean;

	/**
	 * number of trellis loops.
	 *
	 * @default 1
	 */
	trellisLoops?: number;

	autoSubsample?: boolean;
	chromaSubsample?: number;
	separateChromaQuality?: boolean;
	chromaQuality?: number;
}

export const defaultOptions: Required<Options> = {
	quality: 75,
	baseline: false,
	arithmetic: false,
	progressive: true,
	optimizeCoding: true,
	smoothing: 0,
	colorSpace: ColorSpace.YCbCr,
	quantTable: Quantization.ImageMagick,
	trellisMultipass: false,
	trellisOptZero: false,
	trellisOptTable: false,
	trellisLoops: 1,
	autoSubsample: true,
	chromaSubsample: 2,
	separateChromaQuality: false,
	chromaQuality: 75,
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
