import wasmFactoryEnc from "../dist/webp-enc.js";
import wasmFactoryDec from "../dist/webp-dec.js";
import { check, ImageDataLike, loadES, WasmSource } from "./common.js";

export enum Preprocess {
	None,
	SegmentSmooth,
	Dithering,
}

export enum AlphaFiltering {
	None = 0,
	Fast,
	Best,
}

export interface Options {
	/**
	 * Encode the image without any loss. For images with fully transparent area,
	 * the invisible pixel values (R/G/B or Y/U/V) will be preserved only if the `exact` option is used.
	 *
	 * @default false
	 */
	lossless?: boolean;

	/**
	 * Specify the level of near-lossless image preprocessing. This option adjusts pixel values
	 * to help compressibility, but has minimal impact on the visual quality.
	 * It triggers lossless compression mode automatically.
	 *
	 * The range is 0 (maximum preprocessing) to 100 (no preprocessing).
	 * The typical value is around 60. Note that lossy with -q 100 can at times yield better results.
	 *
	 * @default 100
	 */
	near_lossless?: number;

	/**
	 * Specify the compression factor for RGB channels between 0 and 100.
	 *
	 * In case of lossy compression (default), a small factor produces a smaller file
	 * with lower quality.  Best quality is achieved by using a value of 100.
	 *
	 * In case of lossless compression, a small factor enables faster compression speed,
	 * but produces a larger file. Maximum compression is achieved by using a value of 100.
	 *
	 * @default 75
	 */
	quality?: number;

	/**
	 * Specify the compression factor for alpha compression between 0 and 100.
	 * Lossless compression of alpha is achieved using a value of 100, while the lower
	 * values result in a lossy compression. The default is 100.
	 *
	 * @default 100
	 */
	alpha_quality?: number;

	/**
	 * Specify the compression method to use. This parameter controls the trade off between
	 * encoding speed and the compressed file size and quality.
	 *
	 * Possible values range from 0 to 6. When higher values are used, the encoder will spend more
	 * time inspecting additional encoding possibilities and decide on the quality gain.
	 *
	 * Lower value can result in faster processing at the expense of larger file size and lower quality.
	 *
	 * @default 4
	 */
	method?: number;

	/**
	 * Specify the amplitude of the spatial noise shaping. Spatial noise shaping (or sns for short)
	 * refers to a general collection of built-in algorithms used to decide which area of the
	 * picture should use relatively less bits, and where else to better transfer these bits.
	 *
	 * The possible range goes from 0 (algorithm is off) to 100 (the maximal effect).
	 *
	 * @default 50
	 */
	sns_strength?: number;

	/**
	 * Specify the strength of the deblocking filter, between 0 (no filtering) and 100 (maximum filtering).
	 * A value of 0 will turn off any filtering. Higher value will increase the strength of the filtering
	 * process applied after decoding the picture. The higher the value the smoother the picture will appear.
	 *
	 * @default 60
	 */
	filter_strength?: number;

	/**
	 * Specify the sharpness of the filtering (if used). Range is 0 (sharpest) to 7 (least sharp).
	 *
	 * @default 0
	 */
	filter_sharpness?: number;

	/**
	 * Use strong filtering (if filtering is being used thanks to the `filter_strength`).
	 *
	 * @default true
	 */
	filter_type?: boolean;

	/**
	 * Change the number of partitions to use during the segmentation of the sns algorithm.
	 * Range [1, 4], this option has no effect for methods 3 and up, unless `low_memory` is used.
	 *
	 * @default 4
	 */
	segments?: number;

	/**
	 * Specify some pre-processing steps. Using a value of 2 will trigger quality-dependent pseudo-random
	 * dithering during RGBA->YUVA conversion (lossy compression only).
	 *
	 * @default Preprocess.None
	 */
	preprocessing?: Preprocess;

	/**
	 * Turns auto-filter on. This algorithm will spend additional time optimizing the
	 * filtering strength to reach a well-balanced quality.
	 *
	 * @default 0
	 */
	autofilter?: boolean;

	/**
	 * Degrade quality by limiting the number of bits used by some macroblocks.
	 * Range is 0 (no degradation, the default) to 100 (full degradation).
	 * Useful values are usually around 30-70 for moderately large images.
	 *
	 * In the VP8 format, the so-called control partition has a limit of 512k and is used to store
	 * the following information: whether the macroblock is skipped, which segment it belongs to,
	 * whether it is coded as intra 4x4 or intra 16x16 mode, and finally the prediction modes to use
	 * for each of the sub-blocks.
	 *
	 * For a very large image, 512k only leaves room for a few bits per 16x16 macroblock.
	 * The absolute minimum is 4 bits per macroblock. Skip, segment, and mode information can use up almost
	 * all these 4 bits (although the case is unlikely), which is problematic for very large images.
	 *
	 * The partition_limit factor controls how frequently the most bit-costly mode (intra 4x4) will be used.
	 * This is useful in case the 512k limit is reached.
	 *
	 * If using -partition_limit is not enough to meet the 512k constraint, one should use less segments
	 * in order to save more header bits per macroblock. See the `segments` option.
	 *
	 * Note the -m and -q options also influence the encoder's decisions and ability to hit this limit.
	 *
	 * @default 0
	 */
	partition_limit?: number;

	/**
	 * Specify the algorithm used for alpha compression: 0 or 1.
	 * Algorithm 0 denotes no compression, 1 uses WebP lossless format for compression.
	 *
	 * @default 1
	 */
	alpha_compression?: number;

	/**
	 * Specify the predictive filtering method for the alpha plane. One of none,
	 * fast or best, in increasing complexity and slowness order.
	 *
	 * Internally, alpha filtering is performed using four possible predictions (none, horizontal, vertical, gradient).
	 * The best mode will try each mode in turn and pick the one which gives the smaller size.
	 *
	 * The fast mode will just try to form an a priori guess without testing all modes.
	 *
	 * @default AlphaFiltering.Fast
	 */
	alpha_filtering?: AlphaFiltering;

	/**
	 * Use more accurate and sharper RGB->YUV conversion if needed.
	 * Note that this process is slower than the default conversion.
	 *
	 * @default false
	 */
	use_sharp_yuv?: boolean;

	/**
	 * Preserve RGB values in transparent area. The default is off, to help compressibility.
	 */
	exact?: boolean;

	/**
	 * Specify a target size (in bytes) to try and reach for the compressed output.
	 * The compressor will make several passes of partial encoding in order to get as close as possible to this target.
	 * If both `target_size` and `target_PSNR` are used, `target_size` value will prevail.
	 */
	target_size?: number;

	/**
	 * Specify a target PSNR (in dB) to try and reach for the compressed output.
	 * The compressor will make several passes of partial encoding in order to get as close as possible to this target.
	 * If both `target_size` and `target_PSNR` are used, `target_size` value will prevail.
	 */
	target_PSNR?: number;

	/**
	 * Set a maximum number of passes to use during the dichotomy used by `target_size` or `target_PSNR`.
	 *
	 * Maximum value is 10. If options `target_size` or `target_PSNR` were used, but `pass` wasn't specified,
	 * a default value of '6' passes will be used. If `pass` is specified,
	 * but neither `target_size` nor `target_PSNR` are, a target PSNR of 40dB will be used.
	 *
	 * @default 1
	 */
	pass?: number;

	/**
	 * Reduce memory usage of lossy encoding by saving four times the compressed size (typically).
	 * This will make the encoding slower and the output slightly different in size and distortion.
	 *
	 * This flag is only effective for methods 3 and up, and is off by default.
	 *
	 * Note that leaving this flag off will have some side effects on the bitstream:
	 * it forces certain bitstream features like number of partitions (forced to 1).
	 *
	 * @default false
	 */
	low_memory?: boolean;

	/**
	 * Change the internal parameter mapping to better match the expected size of JPEG compression.
	 *
	 * This flag will generally produce an output file of similar size to its JPEG equivalent
	 * (for the same `quality` setting), but with less visual distortion.
	 *
	 * @default false
	 */
	emulate_jpeg_size?: boolean;
}

export const defaultOptions: Required<Options> & Record<string, any> = {
	lossless: false,
	near_lossless: 100,
	quality: 75,
	target_size: 0,
	target_PSNR: 0,
	method: 4,
	sns_strength: 50,
	filter_strength: 60,
	filter_sharpness: 0,
	filter_type: true,
	segments: 4,
	pass: 1,
	use_sharp_yuv: false,
	preprocessing: Preprocess.None,
	autofilter: false,
	partition_limit: 0,
	alpha_compression: 1,
	alpha_filtering: AlphaFiltering.Fast,
	alpha_quality: 100,
	exact: false,
	emulate_jpeg_size: false,
	low_memory: false,

	// Undocumented options, only for compatibility.
	partitions: 0,
	show_compressed: 0,
	image_hint: 0,
	thread_level: 0,
	use_delta_palette: 0,
};

export const mimeType = "image/webp";
export const extension = "webp";

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
	return check<Uint8Array>(result, "Webp Encode");
}

export function decode(input: BufferSource) {
	return check<ImageData>(decoderWASM.decode(input), "Webp Decode");
}
