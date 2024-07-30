import wasmFactoryEnc from "../dist/jxl-enc.js";
import wasmFactoryDec from "../dist/jxl-dec.js";
import { check, loadES, WasmSource } from "./common.js";

export interface Options {
	effort?: number;
	quality?: number;
	progressive?: boolean;
	epf?: number;
	lossyPalette?: boolean;
	decodingSpeedTier?: number;
	photonNoiseIso?: number;
	lossyModular?: boolean;
}

export const defaultOptions: Required<Options> = {
	effort: 7,
	quality: 75,
	progressive: false,
	epf: -1,
	lossyPalette: false,
	decodingSpeedTier: 0,
	photonNoiseIso: 0,
	lossyModular: false,
};

export const mimeType = "image/jxl";
export const extension = "jxl";

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
	return check<Uint8Array>(result, "JXL Encode");
}

export function decode(input: BufferSource) {
	return check<ImageData>(decoderWASM.decode(input), "JXL Decode");
}
