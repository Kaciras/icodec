export interface ICodec<T> {

	encode(data: BufferSource, width: number, height: number, options: T): Promise<Uint8Array>;

	// decode(data: BufferSource): Promise<Omit<ImageData, "colorSpace">>;
}

interface WebPOptions {
	quality: number;
	target_size: number;
	target_PSNR: number;
	method: number;
	sns_strength: number;
	filter_strength: number;
	filter_sharpness: number;
	filter_type: number;
	partitions: number;
	segments: number;
	pass: number;
	show_compressed: number;
	preprocessing: number;
	autofilter: number;
	partition_limit: number;
	alpha_compression: number;
	alpha_filtering: number;
	alpha_quality: number;
	lossless: number;
	exact: number;
	image_hint: number;
	emulate_jpeg_size: number;
	thread_level: number;
	low_memory: number;
	near_lossless: number;
	use_delta_palette: number;
	use_sharp_yuv: number;
}

const dw: WebPOptions = {
	quality: 75,
	target_size: 0,
	target_PSNR: 0,
	method: 4,
	sns_strength: 50,
	filter_strength: 60,
	filter_sharpness: 0,
	filter_type: 1,
	partitions: 0,
	segments: 4,
	pass: 1,
	show_compressed: 0,
	preprocessing: 0,
	autofilter: 0,
	partition_limit: 0,
	alpha_compression: 1,
	alpha_filtering: 1,
	alpha_quality: 100,
	lossless: 0,
	exact: 0,
	image_hint: 0,
	emulate_jpeg_size: 0,
	thread_level: 0,
	low_memory: 0,
	near_lossless: 100,
	use_delta_palette: 0,
	use_sharp_yuv: 0,
};

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

export const WebP: ICodec<WebPOptions> = {
	async encode(data, width, height, options) {
		const module = await import("./lib/webp-enc.js");
		const instance = await module.default();
		const result = await instance.encode(data, width, height, options);
		if (result) {
			return result;
		}
		throw new Error("Encode failed");
	}
}

export const AVIF: ICodec<WebPOptions> = {
	async encode(data, width, height, options) {
		const module = await import("./lib/avif-enc.js");
		const instance = await module.default();
		const result = await instance.encode(data, width, height, options);
		if (result) {
			return result;
		}
		throw new Error("Encode failed");
	}
}

export const enum MozJpegColorSpace {
	GRAYSCALE = 1,
	RGB,
	YCbCr,
}

export  interface MozJPEGOptions {
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
