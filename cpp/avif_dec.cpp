#include <emscripten/bind.h>
#include "icodec.h"
#include "avif/avif.h"

#define CHECK_STATUS(s) if (s != AVIF_RESULT_OK)	\
{													\
	return val(avifResultToString(s));				\
}

/**
 * AVIF decode from memory. Implementation reference:
 * https://github.com/AOMediaCodec/libavif/blob/main/examples/avif_example_decode_memory.c
 */
val decode(std::string input)
{
	auto bytes = reinterpret_cast<uint8_t *>(input.data());
	auto decoder = toRAII(avifDecoderCreate(), avifDecoderDestroy);
	if (!decoder)
	{
		return val("Out of memory");
	}

	// Do not use `avifDecoderReadMemory`, it will do a redundant copy.
	CHECK_STATUS(avifDecoderSetIOMemory(decoder.get(), bytes, input.length()));

	// Read metadata from header.
	CHECK_STATUS(avifDecoderParse(decoder.get()));

	// Read the first image frame data.
	CHECK_STATUS(avifDecoderNextImage(decoder.get()));

	// Create a RGB image structure describe the format we want.
	// Defaults to AVIF_RGB_FORMAT_RGBA.
	avifRGBImage rgb;
	avifRGBImageSetDefaults(&rgb, decoder->image);

	// Convert libavif internal image structure to our RGBA format.
	CHECK_STATUS(avifRGBImageAllocatePixels(&rgb));
	CHECK_STATUS(avifImageYUVToRGB(decoder->image, &rgb));

	auto _ = toRAII(&rgb, avifRGBImageFreePixels);
	return toImageData(rgb.pixels, rgb.width, rgb.height, rgb.depth);
}

EMSCRIPTEN_BINDINGS(icodec_module_AVIF)
{
	function("decode", &decode);
}
