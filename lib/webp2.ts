import { check, loadES, WasmSource } from "./common.js";
import wasmFactoryEnc from "../dist/wp2-enc.js";
import wasmFactoryDec from "../dist/wp2-dec.js";

export enum UVMode {
	UVAdapt,
	UV420,
	UV444,
	UVAuto,
}

export enum Csp {
	YCoCg,
	YCbCr,
	Custom,
	YIQ,
}

export interface Options {
	quality?: number;
	alpha_quality?: number;
	effort?: number;
	pass?: number;
	sns?: number;
	uv_mode?: UVMode;
	csp_type?: Csp;
	error_diffusion?: number;
	use_random_matrix?: boolean;
}

export const defaultOptions: Options = {
	quality: 75,
	alpha_quality: 75,
	effort: 5,
	pass: 1,
	sns: 50,
	uv_mode: UVMode.UVAuto,
	csp_type: Csp.YCoCg,
	error_diffusion: 0,
	use_random_matrix: false,
};

export const mimeType = "image/webp2";
export const extension = "wp2";

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
	return check<Uint8Array>(result, "Webp2 Encode");
}

export function decode(input: BufferSource) {
	return check<ImageData>(decoderWASM.decode(input), "Webp2 Decode");
}
