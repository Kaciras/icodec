#include <emscripten/bind.h>
#include <emscripten/val.h>
#include <stdint.h>

#define QOI_IMPLEMENTATION
#include "qoi.h"
#include "icodec.h"

using std::string;
using std::unique_ptr;

val encode(string buffer, uint32_t width, uint32_t height)
{
	qoi_desc desc{ width, height, 4, QOI_SRGB };
	int outSize;
	auto encoded = (uint8_t *)qoi_encode(buffer.c_str(), &desc, &outSize);

	if (encoded == NULL)
	{
		return val::null();
	}
	return toUint8Array(toRAII(encoded, free).get(), outSize);
}

val decode(string input)
{
	qoi_desc desc; // Resultant width and height stored in descriptor.

	auto buffer = qoi_decode(input.c_str(), input.length(), &desc, 4);
	auto result = toRAII((uint8_t *)buffer, free);

	return toImageData(result.get(), desc.width, desc.height);
}

EMSCRIPTEN_BINDINGS(icodec_module_QOI)
{
	function("encode", &encode);
	function("decode", &decode);
}
