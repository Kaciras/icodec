import loadWASM from "../dist/mozjpeg-enc.js";
import { readFileSync } from "fs";

export const enum MozJpegColorSpace {
	GRAYSCALE = 1,
	RGB,
	YCbCr,
}

export interface MozJPEGOptions {
	quality: number;
	baseline: boolean;
	arithmetic: boolean;
	progressive: boolean;
	optimize_coding: boolean;
	smoothing: number;
	color_space: MozJpegColorSpace;
	quant_table: number;
	trellis_multipass: boolean;
	trellis_opt_zero: boolean;
	trellis_opt_table: boolean;
	trellis_loops: number;
	auto_subsample: boolean;
	chroma_subsample: number;
	separate_chroma_quality: boolean;
	chroma_quality: number;
}

const defaultOptions: MozJPEGOptions = {
	quality: 75,
	baseline: false,
	arithmetic: false,
	progressive: true,
	optimize_coding: true,
	smoothing: 0,
	color_space: MozJpegColorSpace.YCbCr,
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

let wasmModule: any;

export async function initialize() {
	const wasmBinary = readFileSync("dist/mozjpeg-enc.wasm");
	wasmModule = await loadWASM({ wasmBinary });
}

export function encode(data: BufferSource, width: number, height: number, options: MozJPEGOptions) {
	options = { ...defaultOptions, ...options };
	const result = wasmModule.encode(data, width, height, options);
	if (result) {
		return result;
	}
	throw new Error("Encode failed");
}
