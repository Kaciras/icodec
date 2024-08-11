import wasmFactoryEnc from "../dist/jxl-enc.js";
import wasmFactoryDec from "../dist/jxl-dec.js";
import { check, ImageDataLike, loadES, WasmSource } from "./common.js";

export interface Options {
	/**
	 * If true, encode the image without any loss.
	 *
	 * @default false
	 */
	lossless?: boolean;

	/**
	 * Sets encoder effort/speed level without affecting decoding speed.
	 * Valid values are, from faster to slower speed: [1, 9].
	 *
	 * @default 7
	 */
	effort?: number;

	quality?: number;
	progressive?: boolean;

	/**
	 * Edge preserving filter level, -1 to 3.
	 * Use -1 for the default (encoder chooses), 0 to 3 to set a strength.
	 *
	 * @default -1
	 */
	epf?: number;

	/**
	 * Enables or disables delta palette. Use -1 for the default (encoder chooses),
	 * 0 to disable, 1 to enable. Used in modular mode.
	 */
	lossyPalette?: boolean;

	/**
	 * Sets the decoding speed tier for the provided options.
	 *
	 * Minimum is 0 (slowest to decode, best quality/density), and
	 * maximum is 4 (fastest to decode, at the cost of some quality/density).
	 *
	 * @default 0
	 */
	decodingSpeedTier?: number;

	/**
	 * Adds noise to the image emulating photographic film noise, the higher the
	 * given number, the grainier the image will be. As an example, a value of 100
	 * gives low noise whereas a value of 3200 gives a lot of noise.
	 *
	 * @default 0
	 */
	photonNoiseIso?: number;

	lossyModular?: boolean;
}

export const defaultOptions: Required<Options> = {
	lossless: false,
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
	return encoderWASM ??= await loadES(wasmFactoryEnc, input);
}

export async function loadDecoder(input?: WasmSource) {
	return decoderWASM ??= await loadES(wasmFactoryDec, input);
}

export function encode(image: ImageDataLike, options?: Options) {
	options = { ...defaultOptions, ...options };
	const { data, width, height } = image;
	const result = encoderWASM.encode(data, width, height, options);
	return check<Uint8Array>(result, "JXL Encode");
}

export function decode(input: BufferSource) {
	return check<ImageData>(decoderWASM.decode(input), "JXL Decode");
}
