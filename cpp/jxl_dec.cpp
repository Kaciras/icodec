#include <emscripten/bind.h>
#include <jxl/decode.h>
#include "icodec.h"

#define EXPECT_EQ(a, b) if (a != b) { return val::null(); }

val decode(std::string input)
{
	static const JxlPixelFormat format = {CHANNELS_RGBA, JXL_TYPE_UINT8, JXL_LITTLE_ENDIAN, 0};
	static const int EVENTS = JXL_DEC_BASIC_INFO | JXL_DEC_FULL_IMAGE;

	auto decoder = JxlDecoderCreate(nullptr);

	EXPECT_EQ(JXL_DEC_SUCCESS, JxlDecoderSubscribeEvents(decoder, EVENTS));

	auto bytes = reinterpret_cast<uint8_t *>(input.data());
	JxlDecoderSetInput(decoder, bytes, input.size());
	EXPECT_EQ(JXL_DEC_BASIC_INFO, JxlDecoderProcessInput(decoder));

	JxlBasicInfo info;
	EXPECT_EQ(JXL_DEC_SUCCESS, JxlDecoderGetBasicInfo(decoder, &info));
	EXPECT_EQ(JXL_DEC_NEED_IMAGE_OUT_BUFFER, JxlDecoderProcessInput(decoder));

	size_t length = info.xsize * info.ysize * CHANNELS_RGBA;
	size_t buffer_size;
	EXPECT_EQ(JXL_DEC_SUCCESS, JxlDecoderImageOutBufferSize(decoder, &format, &buffer_size));

	auto output = std::make_unique_for_overwrite<uint8_t[]>(length);
	EXPECT_EQ(JXL_DEC_SUCCESS, JxlDecoderSetImageOutBuffer(
		decoder,
		&format,
		output.get(),
		length
	));
	EXPECT_EQ(JXL_DEC_FULL_IMAGE, JxlDecoderProcessInput(decoder));

	JxlDecoderDestroy(decoder);
	return toImageData(output.get(), info.xsize, info.ysize);
}

EMSCRIPTEN_BINDINGS(icodec_module_JXL)
{
	function("decode", &decode);
}
