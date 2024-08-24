#include <emscripten/bind.h>
#include <jxl/decode.h>
#include "icodec.h"

#define PROCESS_NEXT_STEP(event)                  \
	if (JxlDecoderProcessInput(decoder) != event) \
	{                                             \
		return val(#event);                       \
	}

#define CHECK_STATUS(s)       \
	if (s != JXL_DEC_SUCCESS) \
	{                         \
		return val::null();   \
	}

val decode(std::string input)
{
	static const JxlPixelFormat format = {CHANNELS_RGBA, JXL_TYPE_UINT8, JXL_LITTLE_ENDIAN, 0};
	static const int EVENTS = JXL_DEC_BASIC_INFO | JXL_DEC_FULL_IMAGE;

	auto decoder = JxlDecoderCreate(nullptr);
	CHECK_STATUS(JxlDecoderSubscribeEvents(decoder, EVENTS));

	auto bytes = reinterpret_cast<uint8_t *>(input.data());
	JxlDecoderSetInput(decoder, bytes, input.size());
	PROCESS_NEXT_STEP(JXL_DEC_BASIC_INFO);

	JxlBasicInfo info;
	CHECK_STATUS(JxlDecoderGetBasicInfo(decoder, &info));
	PROCESS_NEXT_STEP(JXL_DEC_NEED_IMAGE_OUT_BUFFER);

	size_t length = info.xsize * info.ysize * CHANNELS_RGBA;
	size_t buffer_size;
	CHECK_STATUS(JxlDecoderImageOutBufferSize(decoder, &format, &buffer_size));

	auto output = std::make_unique_for_overwrite<uint8_t[]>(length);
	CHECK_STATUS(JxlDecoderSetImageOutBuffer(decoder, &format, output.get(), length));
	PROCESS_NEXT_STEP(JXL_DEC_FULL_IMAGE);

	JxlDecoderDestroy(decoder);
	return toImageData(output.get(), info.xsize, info.ysize);
}

EMSCRIPTEN_BINDINGS(icodec_module_JXL)
{
	function("decode", &decode);
}
