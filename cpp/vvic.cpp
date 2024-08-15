#include <memory>
#include <string>
#include <emscripten/bind.h>
#include <emscripten/val.h>
#include "icodec.h"
#include "libheif/heif_cxx.h"

using namespace emscripten;

struct VvicOptions
{
	int quality;
	bool lossless;
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

val encode(std::string input, int width, int height, HeicOptions options)
{
	auto image = heif::Image();
	image.create(width, height, heif_colorspace_RGB, heif_chroma_interleaved_RGBA);
	image.add_plane(heif_channel_interleaved, width, height, COLOR_DEPTH);

	auto row_bytes = width * CHANNELS_RGBA;
	int stride;
	uint8_t *p = image.get_plane(heif_channel_interleaved, &stride);
	for (auto y = 0; y < height; y++)
	{
		memcpy(p + stride * y, &input[row_bytes * y], stride);
	}

	auto encoder = heif::Encoder(heif_compression_VVC);
	encoder.set_lossy_quality(options.quality);
	encoder.set_lossless(options.lossless);
	encoder.set_string_parameter("preset", options.preset);
	encoder.set_string_parameter("tune", options.tune);
	encoder.set_integer_parameter("tu-intra-depth", options.tuIntraDepth);
	encoder.set_integer_parameter("complexity", options.complexity);
	encoder.set_string_parameter("chroma", options.chroma);

	// encode the image
	auto ctx = heif::Context();
	ctx.encode_image(image, encoder);

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
	const uint8_t *p = image.get_plane(heif_channel_interleaved, &stride);

	auto row_bytes = width * CHANNELS_RGBA;
	auto rgba = std::make_unique<uint8_t[]>(row_bytes * height);
	for (auto y = 0; y < height; y++)
	{
		memcpy(&rgba[row_bytes * y], p + stride * y, row_bytes);
	}

	return toImageData(rgba.get(), (uint32_t)width, (uint32_t)height);
}

EMSCRIPTEN_BINDINGS(icodec_module_VVIC)
{
	function("encode", &encode);
	function("decode", &decode);

	value_object<VvicOptions>("VvicOptions")
		.field("lossless", &VvicOptions::lossless)
		.field("quality", &VvicOptions::quality);
}
