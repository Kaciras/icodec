#include <string>
#include <memory>
#include "emscripten/bind.h"
#include "emscripten/val.h"

#include "icodec.h"
#include "src/webp/decode.h"
#include "src/webp/demux.h"

using namespace emscripten;

val decode(std::string input)
{
	auto bytes = reinterpret_cast<uint8_t *>(input.data());
	int width, height;

	auto rgba = WebPDecodeRGBA(bytes, input.size(), &width, &height);
	std::unique_ptr<uint8_t[]> _(rgba);

	return rgba ? toImageData(rgba, width, height) : val::null();
}

EMSCRIPTEN_BINDINGS(icodec_module_WebP)
{
	function("decode", &decode);
}
