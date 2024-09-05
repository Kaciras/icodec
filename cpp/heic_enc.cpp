#include <string>
#include <emscripten/bind.h>
#include "icodec.h"
#include "libheif/heif_cxx.h"

struct HeicOptions
{
	int quality;
	bool lossless;
	std::string preset;
	std::string tune;
	int tuIntraDepth;
	int complexity;
	std::string chroma;
	bool sharpYUV;

	int bitDepth;
};

struct JSWriter : public heif::Context::Writer
{
	val uint8Array;

	heif_error write(const void *data, size_t size)
	{
		uint8Array = toUint8Array((uint8_t *)data, size);
		return heif_error_success;
	}

	static val writeImageToUint8Array(heif::Context ctx)
	{
		auto writer = JSWriter();
		ctx.write(writer);
		return writer.uint8Array;
	}
};

/**
 * HEIC encode. Implementation reference:
 * https://github.com/strukturag/libheif/blob/master/examples/decoder_png.cc
 * https://github.com/strukturag/libheif/blob/master/examples/heif_enc.cc
 */
val encode(std::string pixels, int width, int height, HeicOptions options)
{
	auto image = heif::Image();
	image.create(width, height, heif_colorspace_RGB, heif_chroma_interleaved_RRGGBBAA_LE);
	image.add_plane(heif_channel_interleaved, width, height, options.bitDepth);

	// Planes can have padding, so we need copy the data by row.
	auto row_bytes = width * CHANNELS_RGBA * ((options.bitDepth + 7) / 8);
	int stride;
	auto p = image.get_plane(heif_channel_interleaved, &stride);
	for (auto y = 0; y < height; y++)
	{
		memcpy(p + stride * y, &pixels[row_bytes * y], stride);
	}

	// libheif does not automitic adjust chroma for lossless.
	if (options.lossless)
	{
		options.chroma = "444";
	}

	auto encoder = heif::Encoder(heif_compression_HEVC);
	encoder.set_lossy_quality(options.quality);
	encoder.set_lossless(options.lossless);
	encoder.set_string_parameter("preset", options.preset);
	encoder.set_string_parameter("tune", options.tune);
	encoder.set_integer_parameter("tu-intra-depth", options.tuIntraDepth);
	encoder.set_integer_parameter("complexity", options.complexity);
	encoder.set_string_parameter("chroma", options.chroma);

	auto context = heif::Context();
	auto config = heif::Context::EncodingOptions();

	if (options.sharpYUV)
	{
		config.color_conversion_options.only_use_preferred_chroma_algorithm = true;
		config.color_conversion_options.preferred_chroma_downsampling_algorithm = heif_chroma_downsampling_sharp_yuv;
	}

	// Must set `matrix_coefficients=0` for exact lossless.
	// https://github.com/strukturag/libheif/pull/1039#issuecomment-1866023028
	if (options.lossless)
	{
		auto nclx = heif_nclx_color_profile_alloc();
		nclx->matrix_coefficients = heif_matrix_coefficients_RGB_GBR;
		config.output_nclx_profile = nclx;

		context.encode_image(image, encoder, config);
		heif_nclx_color_profile_free(nclx);
	}
	else
	{
		context.encode_image(image, encoder, config);
	}

	return JSWriter::writeImageToUint8Array(context);
}

EMSCRIPTEN_BINDINGS(icodec_module_HEIC)
{
	function("encode", &encode);

	value_object<HeicOptions>("HeicOptions")
		.field("lossless", &HeicOptions::lossless)
		.field("quality", &HeicOptions::quality)
		.field("preset", &HeicOptions::preset)
		.field("tune", &HeicOptions::tune)
		.field("tuIntraDepth", &HeicOptions::tuIntraDepth)
		.field("complexity", &HeicOptions::complexity)
		.field("chroma", &HeicOptions::chroma)
		.field("sharpYUV", &HeicOptions::sharpYUV)
		.field("bitDepth", &HeicOptions::bitDepth);
}
