#include <emscripten/bind.h>
#include <emscripten/val.h>
#include <cstdio>
#include "icodec.h"
#include "src/wp2/decode.h"

using namespace emscripten;

val decode(std::string input)
{
	WP2::ArgbBuffer buffer(WP2_rgbA_32);
	WP2Status status = WP2::Decode(input, &buffer);
	if (status != WP2_STATUS_OK)
	{
		return val::null();
	}
	return toImageData(buffer.GetRow8(0), buffer.width(), buffer.height());
}

EMSCRIPTEN_BINDINGS(icodec_module_WebP2)
{
	function("decode", &decode);
}
