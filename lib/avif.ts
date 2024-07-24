import loadEncoderWASM from "../dist/avif-enc.js";
import loadDecoderWASM from "../dist/avif-dec.js";
import { readFileSync } from "fs";

export enum AVIFTune {
	Auto,
	PSNR,
	SSIM,
}

interface AVIFOptions {
	quality: number;
	qualityAlpha: number;
	denoiseLevel: number;
	tileRowsLog2: number;
	tileColsLog2: number;
	speed: number;
	subsample: number;
	chromaDeltaQ: boolean;
	sharpness: number;
	enableSharpYUV: boolean;
	tune: AVIFTune;
}

const defaultOptions: AVIFOptions = {
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

let wasmModule: any;
let wasmModule2: any;

export async function initialize() {
	const wasmBinary = readFileSync("dist/avif-enc.wasm");
	const wasmBinary2 = readFileSync("dist/avif-dec.wasm");
	wasmModule = await loadEncoderWASM({ wasmBinary });
	wasmModule2 = await loadDecoderWASM({ wasmBinary: wasmBinary2 });
}

export function encode(data: BufferSource, width: number, height: number, options: AVIFOptions) {
	options = { ...defaultOptions, ...options };
	const result = wasmModule.encode(data, width, height, options);
	if (result) {
		return result;
	}
	throw new Error("Encode failed");
}

export function decode(image: BufferSource) {
	const result =  wasmModule2.decode(image);
	if (result) {
		return result;
	}
	throw new Error("Decode failed");
}
