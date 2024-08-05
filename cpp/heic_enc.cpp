#include <memory>
#include <string>
#include <emscripten/bind.h>
#include <emscripten/val.h>
#include "icodec.h"
#include "libheif/heif.h"

using namespace emscripten;

struct HeicOptions
{
	int quality;
	bool lossless;
	std::string preset;
	std::string tune;
	int tuIntraDepth;
	int complexity;
	std::string chroma;
};

heif_error WriteToJS(heif_context *ctx, const void *data, size_t size, void *userdata)
{
	val *pointer = static_cast<val *>(userdata);
	*pointer = toUint8Array((uint8_t *)data, size);
	return heif_error_success;
}

val encode(std::string input, int width, int height, HeicOptions options)
{
	auto row_pointers = reinterpret_cast<uint8_t *>(input.data());
	heif_context *ctx = heif_context_alloc();

	// get the default encoder
	heif_encoder *encoder;
	heif_context_get_encoder_for_format(ctx, heif_compression_HEVC, &encoder);
	heif_encoder_set_parameter_integer(encoder, "threads", 1);

	// set the encoder parameters
	heif_encoder_set_lossy_quality(encoder, options.quality);
	heif_encoder_set_lossless(encoder, (int)options.lossless);
	heif_encoder_set_parameter_string(encoder, "preset", options.preset.c_str());
	heif_encoder_set_parameter_string(encoder, "tune", options.tune.c_str());
	heif_encoder_set_parameter_integer(encoder, "tu-intra-depth", options.tuIntraDepth);
	heif_encoder_set_parameter_integer(encoder, "complexity", options.complexity);
	heif_encoder_set_parameter_string(encoder, "chroma", options.chroma.c_str());

	heif_image *image;
	heif_image_create(width, height, heif_colorspace_RGB, heif_chroma_interleaved_RGBA, &image);
	auto error = heif_image_add_plane(image, heif_channel_interleaved, width, height, 32);
	if (error.code)
	{
		return val(error.message);
	}

	int stride;
	uint8_t *p = heif_image_get_plane(image, heif_channel_interleaved, &stride);
	memcpy(p, row_pointers, input.length());

	if (stride != width * CHANNELS_RGB)
	{
		return val(stride);
	}

	// encode the image
	error = heif_context_encode_image(ctx, image, encoder, nullptr, nullptr);
	if (error.code)
	{
		return val(error.message);
	}

	heif_writer writer;
	writer.writer_api_version = 1;
	writer.write = WriteToJS;

	val result;
	heif_context_write(ctx, &writer, &result);

	heif_image_release(image);
	heif_encoder_release(encoder);
	heif_context_free(ctx);

	return result;
}

val decode(std::string input)
{
	heif_context *ctx = heif_context_alloc();

	auto error = heif_context_read_from_memory_without_copy(ctx, input.c_str(), input.length(), nullptr);
	if (error.code)
	{
		return val(error.message);
	}

	// get a handle to the primary image
	heif_image_handle *handle;
	heif_context_get_primary_image_handle(ctx, &handle);

	heif_image *img;
	error = heif_decode_image(handle, &img, heif_colorspace_RGB, heif_chroma_interleaved_RGBA, nullptr);
	if (error.code)
	{
		return val(error.message);
	}

	int height = heif_image_handle_get_height(handle);
	int stride;
	const uint8_t *data = heif_image_get_plane_readonly(img, heif_channel_interleaved, &stride);

	heif_image_release(img);
	heif_image_handle_release(handle);
	heif_context_free(ctx);

	return toImageData(data, (uint32_t)stride / CHANNELS_RGB, (uint32_t)height);
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
		.field("chroma", &HeicOptions::chroma);
}
