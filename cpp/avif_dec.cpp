#include <emscripten/bind.h>
#include <emscripten/val.h>
#include "icodec.h"
#include "avif/avif.h"

using namespace emscripten;

val decode(std::string input)
{
	auto decoder = toRAII(avifDecoderCreate(), avifDecoderDestroy);
	auto image = toRAII(avifImageCreateEmpty(), avifImageDestroy);
	if (!decoder)
	{
		return val("Memory allocation failure");
	}

	auto status = avifDecoderReadMemory(decoder.get(), image.get(), (uint8_t *)input.c_str(), input.length());
	if (status != AVIF_RESULT_OK)
	{
		return val(avifResultToString(status));
	}

	// Convert to interleaved RGB(A)/BGR(A) using a libavif-allocated buffer.
	avifRGBImage rgb;
	avifRGBImageSetDefaults(&rgb, image.get()); // Defaults to AVIF_RGB_FORMAT_RGBA which is what we want.
	rgb.depth = 8;

	status = avifRGBImageAllocatePixels(&rgb);
	if (status != AVIF_RESULT_OK)
	{
		return val(avifResultToString(status));
	}

	status = avifImageYUVToRGB(image.get(), &rgb);
	if (status != AVIF_RESULT_OK)
	{
		return val(avifResultToString(status));
	}

	auto result = toImageData(rgb.pixels, rgb.width, rgb.height);
	avifRGBImageFreePixels(&rgb);
	return result;
}

EMSCRIPTEN_BINDINGS(icodec_module_AVIF)
{
	function("decode", &decode);
}
