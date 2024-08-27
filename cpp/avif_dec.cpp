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
	auto decoder = avifDecoderCreate();
	if (!decoder)
	{
		return val("Memory allocation failure");
	}

	// Do not use `avifDecoderReadMemory`, it will do a redundant copy.
	CHECK_STATUS(avifDecoderSetIOMemory(decoder, bytes, input.length()));
	CHECK_STATUS(avifDecoderParse(decoder));
	CHECK_STATUS(avifDecoderNextImage(decoder));

	// Defaults to AVIF_RGB_FORMAT_RGBA which is what we want.
	avifRGBImage rgb;
	avifRGBImageSetDefaults(&rgb, decoder->image);
	rgb.depth = COLOR_DEPTH;

	CHECK_STATUS(avifRGBImageAllocatePixels(&rgb));
	CHECK_STATUS(avifImageYUVToRGB(decoder->image, &rgb));

	auto _ = toRAII(&rgb, avifRGBImageFreePixels);
	avifDecoderDestroy(decoder);

	return toImageData(rgb.pixels, rgb.width, rgb.height);
}

EMSCRIPTEN_BINDINGS(icodec_module_AVIF)
{
	function("decode", &decode);
}
