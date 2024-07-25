#include <emscripten/bind.h>
#include <emscripten/val.h>
#include <inttypes.h>
#include <setjmp.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
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

val encode(std::string image_in, int image_width, int image_height, MozJpegOptions opts)
{
	auto image_buffer = (uint8_t *)image_in.c_str();

	// The code below is basically the `write_JPEG_file` function from
	// https://github.com/mozilla/mozjpeg/blob/master/example.c
	// I just write to memory instead of a file.

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
	cinfo.image_width = image_width;
	cinfo.image_height = image_height;
	cinfo.input_components = 4;
	cinfo.in_color_space = JCS_EXT_RGBA;

	/* 
	 * Now use the library's routine to set default compression parameters.
	 * (You must set at least cinfo.in_color_space before calling this,
	 * since the defaults depend on the source color space.)
	 */
	jpeg_set_defaults(&cinfo);
	jpeg_set_colorspace(&cinfo, (J_COLOR_SPACE)opts.color_space);

	if (opts.quant_table != -1)
	{
		jpeg_c_set_int_param(&cinfo, JINT_BASE_QUANT_TBL_IDX, opts.quant_table);
	}

	cinfo.optimize_coding = opts.optimize_coding;
	cinfo.smoothing_factor = opts.smoothing;
	if (opts.arithmetic)
	{
		cinfo.arith_code = TRUE;
		cinfo.optimize_coding = FALSE;
	}

	jpeg_c_set_int_param(&cinfo, JINT_TRELLIS_NUM_LOOPS, opts.trellis_loops);
	jpeg_c_set_int_param(&cinfo, JINT_DC_SCAN_OPT_MODE, 0);
	jpeg_c_set_bool_param(&cinfo, JBOOLEAN_USE_SCANS_IN_TRELLIS, opts.trellis_multipass);
	jpeg_c_set_bool_param(&cinfo, JBOOLEAN_TRELLIS_EOB_OPT, opts.trellis_opt_zero);
	jpeg_c_set_bool_param(&cinfo, JBOOLEAN_TRELLIS_Q_OPT, opts.trellis_opt_table);

	// A little hacky to build a string for this, but it means we can use
	// set_quality_ratings which does some useful heuristic stuff.
	std::string quality_str = std::to_string(opts.quality);
	if (opts.separate_chroma_quality && opts.color_space == JCS_YCbCr)
	{
		quality_str += "," + std::to_string(opts.chroma_quality);
	}
	char const *pqual = quality_str.c_str();
	set_quality_ratings(&cinfo, (char *)pqual, opts.baseline);

	if (!opts.auto_subsample && opts.color_space == JCS_YCbCr)
	{
		cinfo.comp_info[0].h_samp_factor = opts.chroma_subsample;
		cinfo.comp_info[0].v_samp_factor = opts.chroma_subsample;

		if (opts.chroma_subsample > 2)
		{
			// Otherwise encoding fails.
			jpeg_c_set_int_param(&cinfo, JINT_DC_SCAN_OPT_MODE, 1);
		}
	}

	if (!opts.baseline && opts.progressive)
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

	/* Here we use the library's state variable cinfo.next_scanline as the
	 * loop counter, so that we don't have to keep track ourselves.
	 * To keep things simple, we pass one scanline per call; you can pass
	 * more if you wish, though.
	 */
	int row_stride = image_width * 4; /* JSAMPLEs per row in image_buffer */

	while (cinfo.next_scanline < cinfo.image_height)
	{
		/* 
		 * jpeg_write_scanlines expects an array of pointers to scanlines.
		 * Here the array is only one element long, but you could pass
		 * more than one scanline at a time if that's more convenient.
		 */
		JSAMPROW row_pointer = &image_buffer[cinfo.next_scanline * row_stride];
		(void)jpeg_write_scanlines(&cinfo, &row_pointer, 1);
	}

	/* Step 6: Finish compression */
	jpeg_finish_compress(&cinfo);
	jpeg_destroy_compress(&cinfo);

	auto js_result = toUint8Array(output, size);
	free(output);
	return js_result;
}

EMSCRIPTEN_BINDINGS(icodec_module_MozJpeg)
{
	function("encode", &encode);

	value_object<MozJpegOptions>("MozJpegOptions")
		.field("quality", &MozJpegOptions::quality)
		.field("baseline", &MozJpegOptions::baseline)
		.field("arithmetic", &MozJpegOptions::arithmetic)
		.field("progressive", &MozJpegOptions::progressive)
		.field("optimize_coding", &MozJpegOptions::optimize_coding)
		.field("smoothing", &MozJpegOptions::smoothing)
		.field("color_space", &MozJpegOptions::color_space)
		.field("quant_table", &MozJpegOptions::quant_table)
		.field("trellis_multipass", &MozJpegOptions::trellis_multipass)
		.field("trellis_opt_zero", &MozJpegOptions::trellis_opt_zero)
		.field("trellis_opt_table", &MozJpegOptions::trellis_opt_table)
		.field("trellis_loops", &MozJpegOptions::trellis_loops)
		.field("chroma_subsample", &MozJpegOptions::chroma_subsample)
		.field("auto_subsample", &MozJpegOptions::auto_subsample)
		.field("separate_chroma_quality", &MozJpegOptions::separate_chroma_quality)
		.field("chroma_quality", &MozJpegOptions::chroma_quality);
}
