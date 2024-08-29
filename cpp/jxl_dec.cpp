#include <emscripten/bind.h>
#include <jxl/decode_cxx.h>
#include "icodec.h"

#define PROCESS_NEXT_STEP(event)                  		\
	if (JxlDecoderProcessInput(decoder.get()) != event) \
	{                                             		\
		return val(#event);                       		\
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

	// 1. Create a decoder instance and set event filter.
	auto decoder = JxlDecoderMake(nullptr);
	CHECK_STATUS(JxlDecoderSubscribeEvents(decoder.get(), EVENTS));

	// 2. Set input.
	auto bytes = reinterpret_cast<uint8_t *>(input.data());
	JxlDecoderSetInput(decoder.get(), bytes, input.size());

	// 3. Read metadata.
	PROCESS_NEXT_STEP(JXL_DEC_BASIC_INFO);
	JxlBasicInfo info;
	CHECK_STATUS(JxlDecoderGetBasicInfo(decoder.get(), &info));

	// It seems no need to check JXL_DEC_NEED_IMAGE_OUT_BUFFER
	// 4. Alloc the output buffer. 
	size_t length = info.xsize * info.ysize * CHANNELS_RGBA;
	auto output = std::make_unique_for_overwrite<uint8_t[]>(length);

	// 5. Read pixels data.
	CHECK_STATUS(JxlDecoderSetImageOutBuffer(decoder.get(), &format, output.get(), length));
	PROCESS_NEXT_STEP(JXL_DEC_FULL_IMAGE);

	return toImageData(output.get(), info.xsize, info.ysize);
}

EMSCRIPTEN_BINDINGS(icodec_module_JXL)
{
	function("decode", &decode);
}
