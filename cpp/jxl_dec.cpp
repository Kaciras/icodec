#include <emscripten/bind.h>
#include <emscripten/val.h>

#include <jxl/decode.h>
#include <jxl/decode_cxx.h>
#include "lib/jxl/color_encoding_internal.h"
#include "icodec.h"

using namespace emscripten;

#define CHANNELS 4

#ifndef JXL_DEBUG_ON_ALL_ERROR
#define JXL_DEBUG_ON_ALL_ERROR 0
#endif

#if JXL_DEBUG_ON_ALL_ERROR
#define EXPECT_TRUE(a)                                                 \
	if (!(a))                                                          \
	{                                                                  \
		fprintf(stderr, "Assertion failure (%d): %s\n", __LINE__, #a); \
		return val::null();                                            \
	}
#define EXPECT_EQ(a, b)                                                                                \
	{                                                                                                  \
		int a_ = a;                                                                                    \
		int b_ = b;                                                                                    \
		if (a_ != b_)                                                                                  \
		{                                                                                              \
			fprintf(stderr, "Assertion failure (%d): %s (%d) != %s (%d)\n", __LINE__, #a, a_, #b, b_); \
			return val::null();                                                                        \
		}                                                                                              \
	}
#else
#define EXPECT_TRUE(a)      \
	if (!(a))               \
	{                       \
		return val::null(); \
	}

#define EXPECT_EQ(a, b) EXPECT_TRUE((a) == (b));
#endif

val decode(std::string input)
{
	static const JxlPixelFormat format = {CHANNELS, JXL_TYPE_UINT8, JXL_LITTLE_ENDIAN, 0};
	static const int EVENTS = JXL_DEC_BASIC_INFO | JXL_DEC_FULL_IMAGE;

	auto dec = JxlDecoderMake(nullptr);

	EXPECT_EQ(JXL_DEC_SUCCESS, JxlDecoderSubscribeEvents(dec.get(), EVENTS));

	JxlDecoderSetInput(dec.get(), (const uint8_t *)input.data(), input.size());
	EXPECT_EQ(JXL_DEC_BASIC_INFO, JxlDecoderProcessInput(dec.get()));

	JxlBasicInfo info;
	EXPECT_EQ(JXL_DEC_SUCCESS, JxlDecoderGetBasicInfo(dec.get(), &info));

	// EXPECT_EQ(JXL_DEC_COLOR_ENCODING, JxlDecoderProcessInput(dec.get()));

	EXPECT_EQ(JXL_DEC_NEED_IMAGE_OUT_BUFFER, JxlDecoderProcessInput(dec.get()));

	size_t length = info.xsize * info.ysize * CHANNELS;

	size_t buffer_size;
	EXPECT_EQ(JXL_DEC_SUCCESS, JxlDecoderImageOutBufferSize(dec.get(), &format, &buffer_size));
	EXPECT_EQ(buffer_size, length * sizeof(uint8_t));

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

EMSCRIPTEN_BINDINGS(icodec_module_JPEGXL)
{
	function("decode", &decode);
}
