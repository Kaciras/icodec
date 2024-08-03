import wasmFactoryEnc from "../dist/jpeg-enc.js";
import { check, ImageDataLike, loadES, WasmSource } from "./common.js";

export enum ColorSpace {
	GRAYSCALE = 1,
	RGB,
	YCbCr,
}

// https://github.com/mozilla/mozjpeg/blob/6c9f0897afa1c2738d7222a0a9ab49e8b536a267/jcparam.c#L74
export enum Quantization {
	JPEG_Annex_K,
	Flat,
	MSSIM_Tuned_Kodak,
	ImageMagick,
	PSNR_HVS_M_Tuned_Kodak,
	Klein_Silverstein_Carney,
	Watson_Taylor_Borthwick,
	Ahumada_Watson_Peterson,
	Peterson_Ahumada_Watson,
}

export interface Options {
	quality?: number;
	baseline?: boolean;
	arithmetic?: boolean;
	progressive?: boolean;
	optimize_coding?: boolean;
	smoothing?: number;
	color_space?: ColorSpace;
	quant_table?: Quantization;
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
	quant_table: Quantization.ImageMagick,
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
	return encoderWASM = await loadES(wasmFactoryEnc, input);
}

export function encode(image: ImageDataLike, options?: Options) {
	options = { ...defaultOptions, ...options };
	const { data, width, height } = image;
	const result = encoderWASM.encode(data, width, height, options);
	return check<Uint8Array>(result, "JPEG Encode");
}
