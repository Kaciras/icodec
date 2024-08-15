#include <emscripten/bind.h>
#include <emscripten/val.h>

#include "icodec.h"
#include "lib/include/jxl/encode_cxx.h"

using namespace emscripten;

#define SET_OPTION(key, value)                                                     \
	if (JxlEncoderFrameSettingsSetOption(settings, key, value) != JXL_ENC_SUCCESS) \
	{                                                                              \
		return val(#key);                                                          \
	}

#define SET_FLOAT_OPTION(key, value)                                                    \
	if (JxlEncoderFrameSettingsSetFloatOption(settings, key, value) != JXL_ENC_SUCCESS) \
	{                                                                                   \
		return val(#key);                                                               \
	}

#define CHECK_STATUS(s) if (s != JXL_ENC_SUCCESS) { return val::null(); }

// https://github.com/libjxl/libjxl/blob/e10fb6858fe9cb506f99b5373f64d6b639fe447d/lib/extras/enc/jxl.cc#L97
bool ReadCompressedOutput(JxlEncoder *enc, std::vector<uint8_t> *compressed)
{
	compressed->resize(4096);
	uint8_t *next_out = compressed->data();
	size_t avail_out = compressed->size() - (next_out - compressed->data());
	JxlEncoderStatus result = JXL_ENC_NEED_MORE_OUTPUT;
	while (result == JXL_ENC_NEED_MORE_OUTPUT)
	{
		result = JxlEncoderProcessOutput(enc, &next_out, &avail_out);
		if (result == JXL_ENC_NEED_MORE_OUTPUT)
		{
			size_t offset = next_out - compressed->data();
			compressed->resize(compressed->size() * 2);
			next_out = compressed->data() + offset;
			avail_out = compressed->size() - offset;
		}
	}
	compressed->resize(next_out - compressed->data());
	return result == JXL_ENC_SUCCESS;
}

struct JXLOptions
{
	bool lossless;
	float quality;
	float alphaQuality;
	int effort;
	int brotliEffort;
	int epf;
	int gaborish;
	int decodingSpeed;
	float photonNoiseIso;
	int responsive;
	int progressiveDC;
	int progressiveAC;
	int qProgressiveAC;
	bool modular;
	bool lossyPalette;
	int paletteColors;
	float iterations;
	int modularColorspace;
	int modularPredictor;
};

static const JxlPixelFormat format = {CHANNELS_RGBA, JXL_TYPE_UINT8, JXL_LITTLE_ENDIAN, 0};

val encode(std::string pixels, uint32_t width, uint32_t height, JXLOptions options)
{
	const JxlEncoderPtr encoder = JxlEncoderMake(nullptr);
	JxlEncoderAllowExpertOptions(encoder.get());

	JxlBasicInfo basic_info;
	JxlEncoderInitBasicInfo(&basic_info);
	basic_info.uses_original_profile = options.lossless;
	basic_info.xsize = width;
	basic_info.ysize = height;
	basic_info.bits_per_sample = COLOR_DEPTH;
	basic_info.num_extra_channels = 1;
	CHECK_STATUS(JxlEncoderSetBasicInfo(encoder.get(), &basic_info));

	JxlColorEncoding color_encoding = {};
	JxlColorEncodingSetToSRGB(&color_encoding, JXL_FALSE);
	CHECK_STATUS(JxlEncoderSetColorEncoding(encoder.get(), &color_encoding));

	auto settings = JxlEncoderFrameSettingsCreate(encoder.get(), nullptr);
	if (options.lossless)
	{
		CHECK_STATUS(JxlEncoderSetFrameLossless(settings, JXL_TRUE));
	}
	else
	{
		auto distance = JxlEncoderDistanceFromQuality(options.quality);
		CHECK_STATUS(JxlEncoderSetFrameDistance(settings, distance));

		distance = JxlEncoderDistanceFromQuality(options.alphaQuality);
		CHECK_STATUS(JxlEncoderSetExtraChannelDistance(settings, 0, distance));
	}
	SET_FLOAT_OPTION(JXL_ENC_FRAME_SETTING_PHOTON_NOISE, options.photonNoiseIso);
	SET_OPTION(JXL_ENC_FRAME_SETTING_EFFORT, options.effort);
	SET_OPTION(JXL_ENC_FRAME_SETTING_BROTLI_EFFORT, options.brotliEffort);
	SET_OPTION(JXL_ENC_FRAME_SETTING_EPF, options.epf);
	SET_OPTION(JXL_ENC_FRAME_SETTING_GABORISH, options.gaborish);
	SET_OPTION(JXL_ENC_FRAME_SETTING_DECODING_SPEED, options.decodingSpeed);

	SET_OPTION(JXL_ENC_FRAME_SETTING_RESPONSIVE, options.responsive);
	SET_OPTION(JXL_ENC_FRAME_SETTING_PROGRESSIVE_DC, options.progressiveDC);
	SET_OPTION(JXL_ENC_FRAME_SETTING_PROGRESSIVE_AC, options.progressiveAC);
	SET_OPTION(JXL_ENC_FRAME_SETTING_QPROGRESSIVE_AC, options.qProgressiveAC);

	SET_OPTION(JXL_ENC_FRAME_SETTING_MODULAR, options.modular);
	SET_OPTION(JXL_ENC_FRAME_SETTING_PALETTE_COLORS, options.paletteColors);
	SET_OPTION(JXL_ENC_FRAME_SETTING_LOSSY_PALETTE, options.lossyPalette);
	SET_OPTION(JXL_ENC_FRAME_SETTING_MODULAR_COLOR_SPACE, options.modularColorspace);
	SET_OPTION(JXL_ENC_FRAME_SETTING_MODULAR_PREDICTOR, options.modularPredictor);
	SET_FLOAT_OPTION(JXL_ENC_FRAME_SETTING_MODULAR_MA_TREE_LEARNING_PERCENT, options.iterations);

	CHECK_STATUS(JxlEncoderAddImageFrame(settings, &format, pixels.data(), pixels.length()));
	JxlEncoderCloseInput(encoder.get());

	std::vector<uint8_t> compressed;
	if (!ReadCompressedOutput(encoder.get(), &compressed))
	{
		return val("ReadCompressedOutput");
	}
	return toUint8Array(compressed.data(), compressed.size());
}

EMSCRIPTEN_BINDINGS(icodec_module_JXL)
{
	function("encode", &encode);

	value_object<JXLOptions>("JXLOptions")
		.field("lossless", &JXLOptions::lossless)
		.field("quality", &JXLOptions::quality)
		.field("alphaQuality", &JXLOptions::alphaQuality)
		.field("effort", &JXLOptions::effort)
		.field("brotliEffort", &JXLOptions::brotliEffort)
		.field("epf", &JXLOptions::epf)
		.field("gaborish", &JXLOptions::gaborish)
		.field("decodingSpeed", &JXLOptions::decodingSpeed)
		.field("photonNoiseIso", &JXLOptions::photonNoiseIso)
		.field("responsive", &JXLOptions::responsive)
		.field("progressiveDC", &JXLOptions::progressiveDC)
		.field("progressiveAC", &JXLOptions::progressiveAC)
		.field("qProgressiveAC", &JXLOptions::qProgressiveAC)
		.field("modular", &JXLOptions::modular)
		.field("lossyPalette", &JXLOptions::lossyPalette)
		.field("paletteColors", &JXLOptions::paletteColors)
		.field("iterations", &JXLOptions::iterations)
		.field("modularColorspace", &JXLOptions::modularColorspace)
		.field("modularPredictor", &JXLOptions::modularPredictor);
}
