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
};

struct JSWriter : public heif::Context::Writer
{
	val uint8Array;

	heif_error write(const void *data, size_t size)
	{
		uint8Array = toUint8Array((uint8_t *)data, size);
		return heif_error_success;
	}
};

val encode(std::string pixels, int width, int height, HeicOptions options)
{
	auto image = heif::Image();
	image.create(width, height, heif_colorspace_RGB, heif_chroma_interleaved_RGBA);
	image.add_plane(heif_channel_interleaved, width, height, COLOR_DEPTH);

	auto row_bytes = width * CHANNELS_RGBA;
	int stride;
	uint8_t *p = image.get_plane(heif_channel_interleaved, &stride);
	for (auto y = 0; y < height; y++)
	{
		memcpy(p + stride * y, &pixels[row_bytes * y], stride);
	}

	auto encoder = heif::Encoder(heif_compression_HEVC);
	encoder.set_lossy_quality(options.quality);
	encoder.set_lossless(options.lossless);
	encoder.set_string_parameter("preset", options.preset);
	encoder.set_string_parameter("tune", options.tune);
	encoder.set_integer_parameter("tu-intra-depth", options.tuIntraDepth);
	encoder.set_integer_parameter("complexity", options.complexity);
	encoder.set_string_parameter("chroma", options.chroma);

	auto ctx = heif::Context();
	auto outputOpts = heif::Context::EncodingOptions();

	if (options.sharpYUV)
	{
		outputOpts.color_conversion_options.only_use_preferred_chroma_algorithm = true;
		outputOpts.color_conversion_options.preferred_chroma_downsampling_algorithm = heif_chroma_downsampling_sharp_yuv;
	}

	// Must set `matrix_coefficients=0` for exact lossless.
	// https://github.com/strukturag/libheif/pull/1039#issuecomment-1866023028
	if (options.lossless && options.chroma == "444")
	{
		auto nclx = heif_nclx_color_profile_alloc();
		nclx->matrix_coefficients = heif_matrix_coefficients_RGB_GBR;
		outputOpts.output_nclx_profile = nclx;

		ctx.encode_image(image, encoder, outputOpts);
		heif_nclx_color_profile_free(nclx);
	}
	else
	{
		ctx.encode_image(image, encoder, outputOpts);
	}

	auto writer = JSWriter();
	ctx.write(writer);
	return writer.uint8Array;
}

val decode(std::string input)
{
	auto ctx = heif::Context();
	ctx.read_from_memory_without_copy(input.c_str(), input.length());

	auto handle = ctx.get_primary_image_handle();
	auto image = handle.decode_image(heif_colorspace_RGB, heif_chroma_interleaved_RGBA);

	auto width = handle.get_width();
	auto height = handle.get_height();
	int stride;
	auto *p = image.get_plane(heif_channel_interleaved, &stride);

	auto row_bytes = width * CHANNELS_RGBA;
	auto rgba = std::make_unique<uint8_t[]>(row_bytes * height);
	for (auto y = 0; y < height; y++)
	{
		memcpy(&rgba[row_bytes * y], p + stride * y, row_bytes);
	}

	return toImageData(rgba.get(), (uint32_t)width, (uint32_t)height);
}

EMSCRIPTEN_BINDINGS(icodec_module_HEIC)
{
	function("encode", &encode);
	function("decode", &decode);

	value_object<HeicOptions>("HeicOptions")
		.field("lossless", &HeicOptions::lossless)
		.field("quality", &HeicOptions::quality)
		.field("preset", &HeicOptions::preset)
		.field("tune", &HeicOptions::tune)
		.field("tuIntraDepth", &HeicOptions::tuIntraDepth)
		.field("complexity", &HeicOptions::complexity)
		.field("chroma", &HeicOptions::chroma)
		.field("sharpYUV", &HeicOptions::sharpYUV);
}
