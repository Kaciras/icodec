#include <emscripten/bind.h>

#define QOI_IMPLEMENTATION
#include "qoi.h"
#include "icodec.h"

/*
 * Although QOI has no encode options, we still add the 4th parameter to
 * keep the function signture, because Enscripten does not allow extra arguments.
 */
val encode(std::string pixels, uint32_t width, uint32_t height, val _)
{
	qoi_desc desc{ width, height, CHANNELS_RGBA, QOI_SRGB };
	int outSize;
	auto encoded = (uint8_t *)qoi_encode(pixels.c_str(), &desc, &outSize);

	if (encoded == NULL)
	{
		return val::null();
	}
	return toUint8Array(toRAII(encoded, free).get(), outSize);
}

val decode(std::string input)
{
	qoi_desc desc; // Resultant width and height stored in descriptor.

	auto buffer = qoi_decode(input.c_str(), input.length(), &desc, CHANNELS_RGBA);
	auto result = toRAII((uint8_t *)buffer, free);

	return toImageData(result.get(), desc.width, desc.height);
}

EMSCRIPTEN_BINDINGS(icodec_module_QOI)
{
	function("encode", &encode);
	function("decode", &decode);
}
