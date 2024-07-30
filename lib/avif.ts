import wasmFactoryEnc from "../dist/avif-enc.js";
import wasmFactoryDec from "../dist/avif-dec.js";
import { check, loadES, WasmSource } from "./common.js";

export enum AVIFTune {
	Auto,
	PSNR,
	SSIM,
}

export interface Options {
	// [0 - 100]
	// 0 = worst quality
	// 100 = lossless
	quality?: number;
	// As above, but -1 means 'use quality'
	qualityAlpha?: number;
	// [0 - 6]
	// Creates 2^n tiles in that dimension
	tileRowsLog2?: number;
	// [0 - 10]
	// 0 = slowest
	// 10 = fastest
	tileColsLog2?: number;
	speed?: number;
	// 0 = 4:0:0
	// 1 = 4:2:0
	// 2 = 4:2:2
	// 3 = 4:4:4
	subsample?: number;
	// Extra chroma compression
	chromaDeltaQ?: boolean;
	// 0-7
	sharpness?: number;
	// 0-50
	denoiseLevel?: number;
	tune?: AVIFTune;
	// toggles AVIF_CHROMA_DOWNSAMPLING_SHARP_YUV
	enableSharpYUV?: boolean;
}

export const defaultOptions: Required<Options> = {
	quality: 50,
	qualityAlpha: -1,
	denoiseLevel: 0,
	tileColsLog2: 0,
	tileRowsLog2: 0,
	speed: 6,
	subsample: 1,
	chromaDeltaQ: false,
	sharpness: 0,
	tune: AVIFTune.Auto,
	enableSharpYUV: false,
};

export const mimeType = "image/avif";
export const extension = "avif";

let encoderWASM: any;
let decoderWASM: any;

export async function loadEncoder(input?: WasmSource) {
	encoderWASM = await loadES(wasmFactoryEnc, input);
}

export async function loadDecoder(input?: WasmSource) {
	decoderWASM = await loadES(wasmFactoryDec, input);
}

export function encode(data: BufferSource, width: number, height: number, options?: Options) {
	options = { ...defaultOptions, ...options };
	const result = encoderWASM.encode(data, width, height, options);
	return check<Uint8Array>(result, "AVIF Encode");
}

export function decode(input: BufferSource) {
	return check<ImageData>(decoderWASM.decode(input), "AVIF Decode");
}
