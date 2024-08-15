import wasmFactoryEnc from "../dist/avif-enc.js";
import wasmFactoryDec from "../dist/avif-dec.js";
import { check, ImageDataLike, loadES, WasmSource } from "./common.js";

export enum Subsampling {
	YUV444 = 1,
	YUV422 = 2,
	YUV420 = 3,
	YUV400 = 4,
}

export enum AVIFTune {
	Auto,
	PSNR,
	SSIM,
}

export interface Options {
	/**
	 * [0 - 100], 0 = worst quality, 100 = lossless
	 *
	 * @default 50
	 */
	quality?: number;

	/**
	 * As above, but -1 means 'use quality'
	 *
	 * @default -1
	 */
	qualityAlpha?: number;

	/**
	 * Range: [-1, 10], 0 = slowest, 10 = fastest, slower should make for a better quality image in less bytes.
	 * A combination of settings are tweaked to simulate this speed range.
	 *
	 * @default 6
	 */
	speed?: number;

	/**
	 * Chrome subsampling type.
	 *
	 * @default YUV420
	 */
	subsample?: Subsampling;

	/**
	 * If true, ignores `tileRowsLog2` and `tileColsLog2` and automatically chooses suitable tiling values.
	 *
	 * @default false
	 */
	autoTiling?: boolean;

	/**
	 * [0 - 6], Creates 2^n tiles in that dimension
	 *
	 * @default 0
	 */
	tileRowsLog2?: number;
	tileColsLog2?: number;

	/**
	 * Extra chroma compression, cannot be used in lossless mode.
	 *
	 * @default false
	 */
	chromaDeltaQ?: boolean;

	/**
	 * Bias towards block sharpness in rate-distortion optimization of transform coefficients [0, 7]
	 *
	 * @default 0
	 */
	sharpness?: number;

	/**
	 * Amount of noise (from 0 = don't denoise, to 50)
	 *
	 * @default 0
	 */
	denoiseLevel?: number;

	/**
	 * Distortion metric tuned with.
	 *
	 * @default  AVIFTune.Auto
	 */
	tune?: AVIFTune;

	/**
	 * toggles AVIF_CHROMA_DOWNSAMPLING_SHARP_YUV
	 *
	 * @default false
	 */
	enableSharpYUV?: boolean;
}

export const defaultOptions: Required<Options> = {
	quality: 50,
	qualityAlpha: -1,
	speed: 6,
	subsample: Subsampling.YUV420,
	autoTiling: false,
	tileColsLog2: 0,
	tileRowsLog2: 0,
	chromaDeltaQ: false,
	sharpness: 0,
	denoiseLevel: 0,
	tune: AVIFTune.Auto,
	enableSharpYUV: false,
};

export const mimeType = "image/avif";
export const extension = "avif";

let encoderWASM: any;
let decoderWASM: any;

export async function loadEncoder(input?: WasmSource) {
	return encoderWASM ??= await loadES(wasmFactoryEnc, input);
}

export async function loadDecoder(input?: WasmSource) {
	return decoderWASM ??= await loadES(wasmFactoryDec, input);
}

export function encode(image: ImageDataLike, options?: Options) {
	options = { ...defaultOptions, ...options };
	const { data, width, height } = image;
	const result = encoderWASM.encode(data, width, height, options);
	return check<Uint8Array>(result, "AVIF Encode");
}

export function decode(input: BufferSource) {
	return check<ImageData>(decoderWASM.decode(input), "AVIF Decode");
}
