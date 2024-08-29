#include <emscripten/bind.h>
#include "icodec.h"
#include "src/wp2/encode.h"

#define CHECK_STATUS(s) if (s != WP2_STATUS_OK)		\
{                                   				\
	return val(WP2GetStatusText(s));				\
}

struct WP2Options
{
	float quality;
	float alpha_quality;
	int effort;
	int pass;
	int uv_mode;
	float sns;
	int csp_type;
	int error_diffusion;
	bool use_random_matrix;
};

val encode(std::string pixels, uint32_t width, uint32_t height, WP2Options options)
{
	auto rgba = reinterpret_cast<uint8_t *>(pixels.data());
	WP2::EncoderConfig config;

	config.quality = options.quality;
	config.alpha_quality = options.alpha_quality;
	config.effort = options.effort;
	config.pass = options.pass;
	config.uv_mode = static_cast<WP2::EncoderConfig::UVMode>(options.uv_mode);
	config.csp_type = static_cast<WP2::Csp>(options.csp_type);
	config.sns = options.sns;
	config.error_diffusion = options.error_diffusion;
	config.use_random_matrix = options.use_random_matrix;

	// Must enable `keep_unmultiplied` and modify the format for exact lossless.
	// https://chromium.googlesource.com/codecs/libwebp2/+/b65d168d3b2b8f8ec849134da2c3a5f034f1eb42/examples/cwp2.cc#868
	WP2SampleFormat format = WP2_Argb_32;
	if (options.quality == 100 && options.alpha_quality == 100)
	{
		format = WP2_ARGB_32;
		config.keep_unmultiplied = true;
	}

	auto src = WP2::ArgbBuffer(format);
	CHECK_STATUS(src.Import(WP2_RGBA_32, width, height, rgba, CHANNELS_RGBA * width));

	WP2::MemoryWriter memory_writer;
	CHECK_STATUS(WP2::Encode(src, &memory_writer, config));

	return toUint8Array(memory_writer.mem_, memory_writer.size_);
}

EMSCRIPTEN_BINDINGS(icodec_module_WebP2)
{
	function("encode", &encode);

	value_object<WP2Options>("WP2Options")
		.field("quality", &WP2Options::quality)
		.field("alphaQuality", &WP2Options::alpha_quality)
		.field("effort", &WP2Options::effort)
		.field("pass", &WP2Options::pass)
		.field("uvMode", &WP2Options::uv_mode)
		.field("sns", &WP2Options::sns)
		.field("cspType", &WP2Options::csp_type)
		.field("errorDiffusion", &WP2Options::error_diffusion)
		.field("useRandomMatrix", &WP2Options::use_random_matrix);
}
