#include <string>
#include <emscripten/bind.h>
#include "icodec.h"
#include "libheif/heif_cxx.h"

/**
 * HEIC decode from memory. Implementation reference:
 * https://github.com/saschazar21/webassembly/blob/main/packages/heif/main.cpp
 */
val decode(std::string input)
{
	auto ctx = heif::Context();
	ctx.read_from_memory_without_copy(input.c_str(), input.length());
	auto handle = ctx.get_primary_image_handle();

	auto bitDepth = handle.get_luma_bits_per_pixel();
	auto image = handle.decode_image(heif_colorspace_RGB, bitDepth == 8
		? heif_chroma_interleaved_RGBA : heif_chroma_interleaved_RRGGBBAA_LE);

	auto width = handle.get_width();
	auto height = handle.get_height();
	int stride;
	auto p = image.get_plane(heif_channel_interleaved, &stride);

	auto row_bytes = width * CHANNELS_RGBA * ((bitDepth + 7) / 8);
	auto rgba = std::make_unique_for_overwrite<uint8_t[]>(row_bytes * height);
	for (auto y = 0; y < height; y++)
	{
		memcpy(&rgba[row_bytes * y], p + stride * y, row_bytes);
	}

	return toImageData(rgba.get(), (uint32_t)width, (uint32_t)height, (uint32_t)bitDepth);
}

EMSCRIPTEN_BINDINGS(icodec_module_HEIC)
{
	function("decode", &decode);
}
