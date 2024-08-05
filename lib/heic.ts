import wasmFactoryEnc from "../dist/heic-enc.js";
import { check, ImageDataLike, loadES, WasmSource } from "./common.js";

export interface Options {
	/**
	 * [0, 100], default 50.
	 */
	quality?: number;
	/**
	 * @default false
	 */
	lossless?: boolean;
	/**
	 * @default "slow"
	 */
	preset?: "ultrafast" | "superfast" | "veryfast" | "faster" | "fast" | "medium" | "slow" | "slower" | "veryslow" | "placebo";
	/**
	 * @default "ssim"
	 */
	tune?: "psnr" | "ssim" | "grain" | "fastdecode";
	/**
	 * [1, 4], default 2.
	 */
	tuIntraDepth?: number;
	/**
	 * [0, 100], default 50.
	 */
	complexity?: number;
	/**
	 * @default "420"
	 */
	chroma?: "420" | "422" | "444";
}

export const defaultOptions: Required<Options> = {
	quality: 50,
	lossless: false,
	preset: "slow",
	tune: "ssim",
	tuIntraDepth: 2,
	complexity: 50,
	chroma: "420",
};

export const mimeType = "image/heic";
export const extension = "heic";

let encoderWASM: any;
let decoderWASM: any;

export async function loadEncoder(input?: WasmSource) {
	return encoderWASM = await loadES(wasmFactoryEnc, input);
}

export async function loadDecoder(input?: WasmSource) {
	return decoderWASM = await loadES(wasmFactoryEnc, input);
}

export function encode(image: ImageDataLike, options?: Options) {
	options = { ...defaultOptions, ...options };
	const { data, width, height } = image;
	const result = encoderWASM.encode(data, width, height, options);
	return check<Uint8Array>(result, "HEIC Encode");
}

export function decode(input: BufferSource) {
	return check<ImageData>(decoderWASM.decode(input), "HEIC Decode");
}
