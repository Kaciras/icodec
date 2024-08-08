import { check, ImageDataLike, loadES, WasmSource } from "./common.js";
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
	/**
	 * Range: [0 = smallest file, 100 = lossless], float type.
	 * Quality 100 is strictly lossless.
	 * Quality above 95 (exclusive) is near lossless.
	 * Quality in [0-95] range will use lossy compression.
	 *
	 * @default 75.0
	 */
	quality?: number;
	/**
	 * Same as `quality` but for alpha channel.
	 *
	 * @default 100.0
	 */
	alpha_quality?: number;
	/**
	 * Compression rate/speed trade-off. [0=faster-bigger .. 9=slower-better]
	 *
	 * @default 5
	 */
	effort?: number;
	/**
	 * Number of entropy-analysis passes. Range: [1..10]
	 *
	 * @default 1
	 */
	pass?: number;
	/**
	 * Spatial noise shaping strength in [0(=off), 100], float type.
	 *
	 * Affects how we spread noise between 'risky' areas (where noise is easily visible)
	 * and easier areas (where it's less visible).
	 *
	 * A high SNS value leads to skewing noise more towards areas where it
	 * should be less visible. In general this improves SSIM but worsens PSNR.
	 *
	 * @default 50.0
	 */
	sns?: number;
	uv_mode?: UVMode;
	csp_type?: Csp;
	/**
	 * error diffusion strength [0=off, 100=max]
	 *
	 * @default 0
	 */
	error_diffusion?: number;

	// Experimental features
	use_random_matrix?: boolean;
}

export const defaultOptions: Required<Options> = {
	quality: 75,
	alpha_quality: 100,
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
	return encoderWASM = await loadES(wasmFactoryEnc, input);
}

export async function loadDecoder(input?: WasmSource) {
	return decoderWASM = await loadES(wasmFactoryDec, input);
}

export function encode(image: ImageDataLike, options?: Options) {
	options = { ...defaultOptions, ...options };
	const { data, width, height } = image;
	const result = encoderWASM.encode(data, width, height, options);
	return check<Uint8Array>(result, "Webp2 Encode");
}

export function decode(input: BufferSource) {
	return check<ImageData>(decoderWASM.decode(input), "Webp2 Decode");
}
