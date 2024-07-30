import wasmFactoryEnc from "../dist/jpeg-enc.js";
import { check, loadES, WasmSource } from "./common.js";

export const enum ColorSpace {
	GRAYSCALE = 1,
	RGB,
	YCbCr,
}

export interface Options {
	quality?: number;
	baseline?: boolean;
	arithmetic?: boolean;
	progressive?: boolean;
	optimize_coding?: boolean;
	smoothing?: number;
	color_space?: ColorSpace;
	quant_table?: number;
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
	quant_table: 3,
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

let encoderWASM: any;

export async function loadEncoder(input?: WasmSource) {
	encoderWASM = await loadES(wasmFactoryEnc, input);
}

export function encode(data: BufferSource, width: number, height: number, options?: Options) {
	options = { ...defaultOptions, ...options };
	const result = encoderWASM.encode(data, width, height, options);
	return check<Uint8Array>(result, "JPEG Encode");
}
