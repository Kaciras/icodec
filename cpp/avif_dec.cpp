#include <emscripten/bind.h>
#include "icodec.h"
#include "avif/avif.h"

#define CHECK_STATUS(s) if (s != AVIF_RESULT_OK)	\
{													\
	return val(avifResultToString(s));				\
}

val decode(std::string input)
{
	auto decoder = toRAII(avifDecoderCreate(), avifDecoderDestroy);
	auto image = toRAII(avifImageCreateEmpty(), avifImageDestroy);
	if (!decoder)
	{
		return val("Memory allocation failure");
	}

	auto bytes = reinterpret_cast<uint8_t *>(input.data());
	CHECK_STATUS(avifDecoderReadMemory(decoder.get(), image.get(), bytes, input.length()));

	// Defaults to AVIF_RGB_FORMAT_RGBA which is what we want.
	avifRGBImage rgb;
	avifRGBImageSetDefaults(&rgb, image.get());
	rgb.depth = COLOR_DEPTH;

	CHECK_STATUS(avifRGBImageAllocatePixels(&rgb));
	CHECK_STATUS(avifImageYUVToRGB(image.get(), &rgb));

	auto _ = toRAII(&rgb, avifRGBImageFreePixels);
	return toImageData(rgb.pixels, rgb.width, rgb.height);
}

EMSCRIPTEN_BINDINGS(icodec_module_AVIF)
{
	function("decode", &decode);
}
