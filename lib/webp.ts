import wasmFactoryEnc from "../dist/webp-enc.js";
import wasmFactoryDec from "../dist/webp-dec.js";
import { check, loadES, WasmSource } from "./common.js";

export interface Options {
	quality?: number;
	target_size?: number;
	target_PSNR?: number;
	method?: number;
	sns_strength?: number;
	filter_strength?: number;
	filter_sharpness?: number;
	filter_type?: number;
	partitions?: number;
	segments?: number;
	pass?: number;
	show_compressed?: number;
	preprocessing?: number;
	autofilter?: number;
	partition_limit?: number;
	alpha_compression?: number;
	alpha_filtering?: number;
	alpha_quality?: number;
	lossless?: number;
	exact?: number;
	image_hint?: number;
	emulate_jpeg_size?: number;
	thread_level?: number;
	low_memory?: number;
	near_lossless?: number;
	use_delta_palette?: number;
	use_sharp_yuv?: number;
}

export const defaultOptions: Required<Options> = {
	quality: 75,
	target_size: 0,
	target_PSNR: 0,
	method: 4,
	sns_strength: 50,
	filter_strength: 60,
	filter_sharpness: 0,
	filter_type: 1,
	partitions: 0,
	segments: 4,
	pass: 1,
	show_compressed: 0,
	preprocessing: 0,
	autofilter: 0,
	partition_limit: 0,
	alpha_compression: 1,
	alpha_filtering: 1,
	alpha_quality: 100,
	lossless: 0,
	exact: 0,
	image_hint: 0,
	emulate_jpeg_size: 0,
	thread_level: 0,
	low_memory: 0,
	near_lossless: 100,
	use_delta_palette: 0,
	use_sharp_yuv: 0,
};

export const mimeType = "image/webp";
export const extension = "webp";

let encoderWASM: any;
let decoderWASM: any;

export async function loadEncoder(input?: WasmSource) {
	return encoderWASM = await loadES(wasmFactoryEnc, input);
}

export async function loadDecoder(input?: WasmSource) {
	return decoderWASM = await loadES(wasmFactoryDec, input);
}

export function encode(data: BufferSource, width: number, height: number, options?: Options) {
	options = { ...defaultOptions, ...options };
	const result = encoderWASM.encode(data, width, height, options);
	return check<Uint8Array>(result, "Webp Encode");
}

export function decode(input: BufferSource) {
	return check<ImageData>(decoderWASM.decode(input), "Webp Decode");
}
