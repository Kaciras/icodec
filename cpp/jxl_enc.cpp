#include <emscripten/bind.h>
#include <emscripten/val.h>

#include "icodec.h"
#include "lib/include/jxl/encode_cxx.h"

using namespace emscripten;

struct JXLOptions
{
	bool lossless;
	float quality;
	int effort;
	int epf;
	size_t decodingSpeedTier;
	float photonNoiseIso;
	bool progressive;
	bool lossyModular;
	bool lossyPalette;
};

val encode(std::string pixels, size_t width, size_t height, JXLOptions options)
{
	static const JxlPixelFormat format = {CHANNELS_RGBA, JXL_TYPE_UINT8, JXL_LITTLE_ENDIAN, 0};
	const JxlEncoderPtr encoder = JxlEncoderMake(nullptr);

	JxlBasicInfo basic_info;
	JxlEncoderInitBasicInfo(&basic_info);
	basic_info.xsize = width;
	basic_info.ysize = height;
	basic_info.bits_per_sample = COLOR_DEPTH;
	// basic_info.uses_original_profile = JXL_TRUE; // mandatory for lossless
	basic_info.num_extra_channels = 1;
	auto status = JxlEncoderSetBasicInfo(encoder.get(), &basic_info);

	JxlColorEncoding color_encoding = {};
	JxlColorEncodingSetToSRGB(&color_encoding, /*is_gray=*/JXL_FALSE);
	status = JxlEncoderSetColorEncoding(encoder.get(), &color_encoding);

	auto settings = JxlEncoderFrameSettingsCreate(encoder.get(), nullptr);
	if (options.lossless)
	{
		status = JxlEncoderSetFrameLossless(settings, JXL_TRUE);
	}
	else
	{
		auto distance = JxlEncoderDistanceFromQuality(options.quality);
		status = JxlEncoderSetFrameDistance(settings, distance);
	}

	JxlEncoderAllowExpertOptions(encoder.get());
	status = JxlEncoderFrameSettingsSetOption(settings, JXL_ENC_FRAME_SETTING_EFFORT, options.effort);
	status = JxlEncoderFrameSettingsSetOption(settings, JXL_ENC_FRAME_SETTING_EPF, options.epf);
	status = JxlEncoderFrameSettingsSetOption(settings, JXL_ENC_FRAME_SETTING_DECODING_SPEED, options.decodingSpeedTier);
	status = JxlEncoderFrameSettingsSetOption(settings, JXL_ENC_FRAME_SETTING_PHOTON_NOISE, options.photonNoiseIso);
	status = JxlEncoderFrameSettingsSetOption(settings, JXL_ENC_FRAME_SETTING_LOSSY_PALETTE, options.lossyPalette);

	// CompressParams cparams;

	// if (options.lossyPalette)
	// {
	// 	cparams.lossy_palette = true;
	// 	cparams.palette_colors = 0;
	// 	cparams.options.predictor = Predictor::Zero;
	// 	// Near-lossless assumes -R 0
	// 	cparams.responsive = 0;
	// 	cparams.modular_mode = true;
	// }

	// Quality settings roughly match libjpeg qualities.
	// if (options.lossyModular || quality == 100)
	// {
	// 	cparams.modular_mode = true;
	// }
	// else
	// {
	// 	cparams.modular_mode = false;
	// }

	// if (options.progressive)
	// {
	// 	cparams.qprogressive_mode = true;
	// 	cparams.responsive = 1;
	// 	if (!cparams.modular_mode)
	// 	{
	// 		cparams.progressive_dc = 1;
	// 	}
	// }

	// if (options.lossless)
	// {
	// 	cparams.SetLossless();
	// }

	status = JxlEncoderAddImageFrame(settings, &format, pixels.data(), pixels.length());
	JxlEncoderCloseInput(encoder.get());

	std::vector<uint8_t> vec;
	vec.resize(256);
	uint8_t *next_out = vec.data();
	size_t avail_out = vec.size() - (next_out - vec.data());
	do
	{
		status = JxlEncoderProcessOutput(encoder.get(), &next_out, &avail_out);
		if (status == JXL_ENC_NEED_MORE_OUTPUT)
		{
			size_t offset = next_out - vec.data();
			vec.resize(vec.size() * 2);
			next_out = vec.data() + offset;
			avail_out = vec.size() - offset;
		}
	} while (status == JXL_ENC_NEED_MORE_OUTPUT);

	vec.resize(next_out - vec.data());
	return toUint8Array(vec.data(), vec.size());
}

EMSCRIPTEN_BINDINGS(icodec_module_JPEGXL)
{
	function("encode", &encode);

	value_object<JXLOptions>("JXLOptions")
		.field("lossless", &JXLOptions::lossless)
		.field("quality", &JXLOptions::quality)
		.field("effort", &JXLOptions::effort)
		.field("progressive", &JXLOptions::progressive)
		.field("epf", &JXLOptions::epf)
		.field("lossyPalette", &JXLOptions::lossyPalette)
		.field("decodingSpeedTier", &JXLOptions::decodingSpeedTier)
		.field("photonNoiseIso", &JXLOptions::photonNoiseIso)
		.field("lossyModular", &JXLOptions::lossyModular);
}
