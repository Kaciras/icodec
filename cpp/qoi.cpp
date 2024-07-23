#include <emscripten/bind.h>
#include <emscripten/val.h>

#define QOI_IMPLEMENTATION
#include "qoi.h"
#include "common.h"

struct QoiOptions
{
};

val encode(std::string buffer, int width, int height, QoiOptions options)
{
	qoi_desc desc;
	desc.width = width;
	desc.height = height;
	desc.channels = 4;
	desc.colorspace = QOI_SRGB;

	int outSize;
	uint8_t *encodedData = (uint8_t *)qoi_encode(buffer.c_str(), &desc, &outSize);
	if (encodedData == NULL)
		return val::null();

	auto js_result = toUint8((uint8_t *)encodedData, outSize);
	free(encodedData);
	return js_result;
}

val decode(std::string input)
{
	qoi_desc desc; // Resultant width and height stored in descriptor.

	auto buffer = qoi_decode(input.c_str(), input.length(), &desc, 4);
	std::unique_ptr<uint8_t, decltype(&free)> result {(uint8_t *)buffer, free};

	return toImageData(result.get(), desc.width, desc.height);
}

EMSCRIPTEN_BINDINGS(my_module)
{
	value_object<QoiOptions>("QoiOptions");
	function("encode", &encode);
	function("decode", &decode);
}
