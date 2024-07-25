#include <string>
#include <memory>
#include "emscripten/bind.h"
#include "emscripten/val.h"

#include "icodec.h"
#include "src/webp/decode.h"
#include "src/webp/demux.h"

using namespace emscripten;

val decode(std::string buffer)
{
	auto bytes = (const uint8_t *)buffer.c_str();
	int width, height;

	std::unique_ptr<uint8_t[]> rgba(WebPDecodeRGBA(bytes, buffer.size(), &width, &height));
	if (!rgba)
	{
		return val::null();
	}
	return toImageData(rgba.get(), width, height);
}

EMSCRIPTEN_BINDINGS(icodec_module_WebP)
{
	function("decode", &decode);
}
