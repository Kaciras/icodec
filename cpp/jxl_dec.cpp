#include <emscripten/bind.h>
#include <jxl/decode.h>
#include <jxl/decode_cxx.h>
#include "icodec.h"
#include "lib/jxl/color_encoding_internal.h"

#define EXPECT_EQ(a, b) if (a != b) { return val::null(); }

val decode(std::string input)
{
	static const JxlPixelFormat format = {CHANNELS_RGBA, JXL_TYPE_UINT8, JXL_LITTLE_ENDIAN, 0};
	static const int EVENTS = JXL_DEC_BASIC_INFO | JXL_DEC_FULL_IMAGE;

	auto dec = JxlDecoderMake(nullptr);

	EXPECT_EQ(JXL_DEC_SUCCESS, JxlDecoderSubscribeEvents(dec.get(), EVENTS));

	auto bytes = reinterpret_cast<uint8_t *>(input.data());
	JxlDecoderSetInput(dec.get(), bytes, input.size());
	EXPECT_EQ(JXL_DEC_BASIC_INFO, JxlDecoderProcessInput(dec.get()));

	JxlBasicInfo info;
	EXPECT_EQ(JXL_DEC_SUCCESS, JxlDecoderGetBasicInfo(dec.get(), &info));
	EXPECT_EQ(JXL_DEC_NEED_IMAGE_OUT_BUFFER, JxlDecoderProcessInput(dec.get()));

	size_t length = info.xsize * info.ysize * CHANNELS_RGBA;
	size_t buffer_size;
	EXPECT_EQ(JXL_DEC_SUCCESS, JxlDecoderImageOutBufferSize(dec.get(), &format, &buffer_size));

	auto output = std::make_unique<uint8_t[]>(length);
	EXPECT_EQ(JXL_DEC_SUCCESS, JxlDecoderSetImageOutBuffer(
		dec.get(),
		&format,
		output.get(),
		length * sizeof(uint8_t)
	));
	EXPECT_EQ(JXL_DEC_FULL_IMAGE, JxlDecoderProcessInput(dec.get()));

	return toImageData(output.get(), info.xsize, info.ysize);
}

EMSCRIPTEN_BINDINGS(icodec_module_JXL)
{
	function("decode", &decode);
}
