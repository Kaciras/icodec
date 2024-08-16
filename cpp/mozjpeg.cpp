#include <emscripten/bind.h>
#include <emscripten/val.h>
#include <inttypes.h>
#include <setjmp.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "icodec.h"
#include "jconfig.h"
#include "jpeglib.h"

extern "C"
{
#include "cdjpeg.h"
}

using namespace emscripten;

struct MozJpegOptions
{
	int quality;
	bool baseline;
	bool arithmetic;
	bool progressive;
	bool optimize_coding;
	int smoothing;
	int color_space;
	int quant_table;
	bool trellis_multipass;
	bool trellis_opt_zero;
	bool trellis_opt_table;
	int trellis_loops;
	bool auto_subsample;
	int chroma_subsample;
	bool separate_chroma_quality;
	int chroma_quality;
};

val encode(std::string pixels, uint32_t width, uint32_t height, MozJpegOptions options)
{
	// The code below is basically the `write_JPEG_file` function from
	// https://github.com/mozilla/mozjpeg/blob/master/example.c
	auto rgba = reinterpret_cast<uint8_t *>(pixels.data());

	/* Step 1: allocate and initialize JPEG compression object */
	jpeg_compress_struct cinfo;
	jpeg_error_mgr jerr;

	/*
	 * We have to set up the error handler first, in case the initialization
	 * step fails.  (Unlikely, but it could happen if you are out of memory.)
	 * This routine fills in the contents of struct jerr, and returns jerr's
	 * address which we place into the link field in cinfo.
	 */
	cinfo.err = jpeg_std_error(&jerr);

	jpeg_create_compress(&cinfo);

	/* Step 2: specify data destination (eg, a file) */
	uint8_t *output = nullptr;
	unsigned long size = 0;
	jpeg_mem_dest(&cinfo, &output, &size);

	/* Step 3: set parameters for compression */
	cinfo.image_width = width;
	cinfo.image_height = height;
	cinfo.input_components = CHANNELS_RGBA;
	cinfo.in_color_space = JCS_EXT_RGBA;

	/*
	 * Now use the library's routine to set default compression parameters.
	 * (You must set at least cinfo.in_color_space before calling this,
	 * since the defaults depend on the source color space.)
	 */
	jpeg_set_defaults(&cinfo);
	jpeg_set_colorspace(&cinfo, (J_COLOR_SPACE)options.color_space);

	if (options.quant_table != -1)
	{
		jpeg_c_set_int_param(&cinfo, JINT_BASE_QUANT_TBL_IDX, options.quant_table);
	}

	cinfo.optimize_coding = options.optimize_coding;
	cinfo.smoothing_factor = options.smoothing;
	if (options.arithmetic)
	{
		cinfo.arith_code = TRUE;
		cinfo.optimize_coding = FALSE;
	}

	jpeg_c_set_int_param(&cinfo, JINT_TRELLIS_NUM_LOOPS, options.trellis_loops);
	jpeg_c_set_int_param(&cinfo, JINT_DC_SCAN_OPT_MODE, 0);
	jpeg_c_set_bool_param(&cinfo, JBOOLEAN_USE_SCANS_IN_TRELLIS, options.trellis_multipass);
	jpeg_c_set_bool_param(&cinfo, JBOOLEAN_TRELLIS_EOB_OPT, options.trellis_opt_zero);
	jpeg_c_set_bool_param(&cinfo, JBOOLEAN_TRELLIS_Q_OPT, options.trellis_opt_table);

	// A little hacky to build a string for this, but it means we can use
	// set_quality_ratings which does some useful heuristic stuff.
	std::string quality_str = std::to_string(options.quality);
	if (options.separate_chroma_quality && options.color_space == JCS_YCbCr)
	{
		quality_str += "," + std::to_string(options.chroma_quality);
	}
	char const *pqual = quality_str.c_str();
	set_quality_ratings(&cinfo, (char *)pqual, options.baseline);

	if (!options.auto_subsample && options.color_space == JCS_YCbCr)
	{
		cinfo.comp_info[0].h_samp_factor = options.chroma_subsample;
		cinfo.comp_info[0].v_samp_factor = options.chroma_subsample;

		if (options.chroma_subsample > 2)
		{
			// Otherwise encoding fails.
			jpeg_c_set_int_param(&cinfo, JINT_DC_SCAN_OPT_MODE, 1);
		}
	}

	if (!options.baseline && options.progressive)
	{
		jpeg_simple_progression(&cinfo);
	}
	else
	{
		cinfo.num_scans = 0;
		cinfo.scan_info = NULL;
	}

	/* Step 4: Start compressor */
	jpeg_start_compress(&cinfo, TRUE);

	/* Step 5: while (scan lines remain to be written) */
	int stride = width * CHANNELS_RGBA;
	while (cinfo.next_scanline < cinfo.image_height)
	{
		/*
		 * jpeg_write_scanlines expects an array of pointers to scanlines.
		 * Here the array is only one element long, but you could pass
		 * more than one scanline at a time if that's more convenient.
		 */
		JSAMPROW p = &rgba[cinfo.next_scanline * stride];
		(void)jpeg_write_scanlines(&cinfo, &p, 1);
	}

	jpeg_finish_compress(&cinfo);
	jpeg_destroy_compress(&cinfo);

	return toUint8Array(toRAII(output, free).get(), size);
}

val decode(std::string input)
{
	auto inBuffer = reinterpret_cast<const uint8_t *>(input.c_str());

	jpeg_decompress_struct cinfo;
	jpeg_error_mgr jerr;

	// Initialize the JPEG decompression object with default error handling.
	cinfo.err = jpeg_std_error(&jerr);
	jpeg_create_decompress(&cinfo);

	jpeg_mem_src(&cinfo, inBuffer, input.length());

	// Read file header, set default decompression parameters.
	jpeg_read_header(&cinfo, TRUE);

	// Force RGBA decoding, even for grayscale images.
	cinfo.out_color_space = JCS_EXT_RGBA;
	jpeg_start_decompress(&cinfo);

	// Prepare output buffer
	size_t output_size = cinfo.output_width * cinfo.output_height * CHANNELS_RGBA;
	std::vector<uint8_t> output(output_size);

	auto stride = cinfo.output_width * CHANNELS_RGBA;
	while (cinfo.output_scanline < cinfo.output_height)
	{
		uint8_t *ptr = &output[stride * cinfo.output_scanline];
		jpeg_read_scanlines(&cinfo, &ptr, 1);
	}

	jpeg_finish_decompress(&cinfo);
	jpeg_destroy_decompress(&cinfo);

	return toImageData(output.data(), cinfo.output_width, cinfo.output_height);
}

EMSCRIPTEN_BINDINGS(icodec_module_MozJpeg)
{
	function("encode", &encode);
	function("decode", &decode);

	value_object<MozJpegOptions>("MozJpegOptions")
		.field("quality", &MozJpegOptions::quality)
		.field("baseline", &MozJpegOptions::baseline)
		.field("arithmetic", &MozJpegOptions::arithmetic)
		.field("progressive", &MozJpegOptions::progressive)
		.field("optimizeCoding", &MozJpegOptions::optimize_coding)
		.field("smoothing", &MozJpegOptions::smoothing)
		.field("colorSpace", &MozJpegOptions::color_space)
		.field("quantTable", &MozJpegOptions::quant_table)
		.field("trellisMultipass", &MozJpegOptions::trellis_multipass)
		.field("trellisOptZero", &MozJpegOptions::trellis_opt_zero)
		.field("trellisOptTable", &MozJpegOptions::trellis_opt_table)
		.field("trellisLoops", &MozJpegOptions::trellis_loops)
		.field("autoSubsample", &MozJpegOptions::chroma_subsample)
		.field("chromaSubsample", &MozJpegOptions::auto_subsample)
		.field("separateChromaQuality", &MozJpegOptions::separate_chroma_quality)
		.field("chromaQuality", &MozJpegOptions::chroma_quality);
}
