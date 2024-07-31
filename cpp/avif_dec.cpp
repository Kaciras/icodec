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

	auto status = avifDecoderReadMemory(decoder.get(), image.get(), (uint8_t *)input.data(), input.length());
	if (status != AVIF_RESULT_OK)
	{
		return val(avifResultToString(status));
	}

	// Convert to interleaved RGB(A)/BGR(A) using a libavif-allocated buffer.
	avifRGBImage rgb;
	 // Defaults to AVIF_RGB_FORMAT_RGBA which is what we want.
	avifRGBImageSetDefaults(&rgb, image.get());
	rgb.depth = COLOR_DEPTH;

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

	auto _ = toRAII(&rgb, avifRGBImageFreePixels);
	return toImageData(rgb.pixels, rgb.width, rgb.height);
}

EMSCRIPTEN_BINDINGS(icodec_module_AVIF)
{
	function("decode", &decode);
}
