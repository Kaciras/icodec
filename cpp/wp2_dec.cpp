#include <emscripten/bind.h>
#include <cstdio>
#include "icodec.h"
#include "src/wp2/decode.h"

val decode(std::string input)
{
	WP2::ArgbBuffer buffer(WP2_RGBA_32);
	WP2Status status = WP2::Decode(input, &buffer);
	if (status != WP2_STATUS_OK)
	{
		return val(WP2GetStatusText(status));
	}
	return toImageData(buffer.GetRow8(0), buffer.width(), buffer.height());
}

EMSCRIPTEN_BINDINGS(icodec_module_WebP2)
{
	function("decode", &decode);
}
