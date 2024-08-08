#include <emscripten/bind.h>
#include <emscripten/val.h>
#include <stdint.h>

#define QOI_IMPLEMENTATION
#include "qoi.h"
#include "icodec.h"

val encode(std::string pixels, uint32_t width, uint32_t height, val _)
{
	qoi_desc desc{ width, height, CHANNELS_RGB, QOI_SRGB };
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

	auto buffer = qoi_decode(input.c_str(), input.length(), &desc, CHANNELS_RGB);
	auto result = toRAII((uint8_t *)buffer, free);

	return toImageData(result.get(), desc.width, desc.height);
}

EMSCRIPTEN_BINDINGS(icodec_module_QOI)
{
	function("encode", &encode);
	function("decode", &decode);
}
