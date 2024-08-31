import wasmFactoryEnc from "../dist/jxl-enc.js";
import wasmFactoryDec from "../dist/jxl-dec.js";
import { check, encodeES, ImageDataLike, loadES, WasmSource } from "./common.js";

// Tristate bool value, `Default` means encoder chooses.
export enum Override { Default = -1, False, True}

export enum Predictor {
	Default = -1,
	Zero,
	Left,
	Top,
	Average0,
	Select,
	Gradient,
	Weighted,
	TopRight,
	TopLeft,
	LeftLeft,
	Average1,
	Average2,
	Average3,
	Average4,
	// The following predictors are encoder-only.
	Best,
	Variable,
}

export interface Options {
	/**
	 * If true, encode the image without any loss.
	 * Some options are ignored in lossless mode.
	 *
	 * @default false
	 */
	lossless?: boolean;

	/**
	 * Quality setting, higher value = higher quality.
	 * 100 = mathematically lossless, 90 = visually lossless.
	 *
	 * Quality values roughly match libjpeg quality.
	 * Recommended range: [68, 96]. Allowed range: [0, 100].
	 *
	 * @default 75
	 */
	quality?: number;

	/**
	 * Quality setting of alpha channel.
	 *
	 * @default 100
	 */
	alphaQuality?: number;

	/**
	 * Sets encoder effort/speed level without affecting decoding speed.
	 * Valid values are, from faster to slower speed: [1, 9].
	 *
	 * @default 7
	 */
	effort?: number;

	/**
	 * Sets brotli encode effort for use in JPEG recompression and compressed metadata boxes (brob).
	 * Can be -1 (default) or 0 (fastest) to 11 (slowest).
	 *
	 * Default is based on the general encode effort in case of JPEG recompression, and 4 for brob boxes.
	 *
	 * @default -1
	 */
	brotliEffort?: number;

	/**
	 * Enables or disables progressive encoding for modular mode.
	 *
	 * @default Override.Default
	 */
	responsive?: Override;

	/**
	 * Progressive-DC setting. Valid values are: -1, 0, 1, 2.
	 *
	 * @default -1
	 */
	progressiveDC?: -1;

	/**
	 * Set the progressive mode for the AC coefficients of VarDCT,
	 * using spectral progression from the DCT coefficients.
	 *
	 * @default Override.Default
	 */
	progressiveAC?: Override;

	/**
	 * Set the progressive mode for the AC coefficients of VarDCT,
	 * using quantization of the least significant bits.
	 *
	 * @default Override.Default
	 */
	qProgressiveAC?: Override;

	/**
	 * Edge preserving filter level, -1 to 3.
	 * Use -1 for the default (encoder chooses), 0 to 3 to set a strength.
	 *
	 * @default -1
	 */
	epf?: number;

	/**
	 * Enables or disables the gaborish filter.
	 *
	 * @default Override.Default
	 */
	gaborish?: Override;

	/**
	 * Sets the decoding speed tier for the provided options.
	 *
	 * Minimum is 0 (slowest to decode, best quality/density), and
	 * maximum is 4 (fastest to decode, at the cost of some quality/density).
	 *
	 * @default 0
	 */
	decodingSpeed?: number;

	/**
	 * Adds noise to the image emulating photographic film noise, the higher the
	 * given number, the grainier the image will be. As an example, a value of 100
	 * gives low noise whereas a value of 3200 gives a lot of noise.
	 *
	 * @default 0
	 */
	photonNoiseIso?: number;

	/**
	 * Enables modular encoding.
	 *
	 * false to enforce VarDCT mode (e.g. for photographic images),
	 * true to enforce modular mode (e.g. for lossless images).
	 *
	 * @default false
	 */
	modular?: boolean;

	/**
	 * Enables or disables delta palette, used in modular mode.
	 *
	 * @default false
	 */
	lossyPalette?: boolean;

	/**
	 * Use color palette if amount of colors is smaller than or equal to this amount,
	 * or -1 to use the encoder default. Used for modular encoding.
	 *
	 * @default -1
	 */
	paletteColors?: number;

	/**
	 * Fraction of pixels used to learn MA trees as a percentage.
	 * Higher values use more memory.
	 *
	 * -1 = default, 0 = no MA and fast decode, 50 = default value, 100 = all.
	 *
	 * @default -1
	 */
	iterations?: number;

	/**
	 * Reversible color transform for modular encoding: -1=default, 0-41=RCT
	 * index, e.g. index 0 = none, index 6 = YCoCg.
	 *
	 * If this option is set to a non-default value, the RCT will be globally applied to the whole frame.
	 *
	 * The default behavior is to try several RCTs locally per modular group,
	 * depending on the speed and distance setting.
	 *
	 * @default -1
	 */
	modularColorspace?: number;

	/**
	 * Predictor for modular encoding.
	 *
	 * @default Predictor.Default,
	 */
	modularPredictor?: Predictor;
}

export const defaultOptions: Required<Options> = {
	lossless: false,
	quality: 75,
	alphaQuality: 100,
	effort: 7,
	brotliEffort: -1,
	epf: -1,
	gaborish: -1,
	responsive: -1,
	progressiveDC: -1,
	progressiveAC: -1,
	qProgressiveAC: -1,
	decodingSpeed: 0,
	photonNoiseIso: 0,
	modular: false,
	lossyPalette: false,
	paletteColors: -1,
	iterations: -1,
	modularColorspace: -1,
	modularPredictor: Predictor.Default,
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
	return encodeES("JXL Encode", encoderWASM, defaultOptions, image, options);
}

export function decode(input: BufferSource) {
	return check<ImageData>(decoderWASM.decode(input), "JXL Decode");
}
