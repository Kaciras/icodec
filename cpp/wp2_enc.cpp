#include <emscripten/bind.h>
#include <emscripten/threading.h>
#include <emscripten/val.h>
#include <cstdio>
#include "icodec.h"
#include "src/wp2/encode.h"

using namespace emscripten;

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

val encode(std::string input, int width, int height, WP2Options options)
{
	WP2::EncoderConfig config = {};

	config.quality = options.quality;
	config.alpha_quality = options.alpha_quality;
	config.effort = options.effort;
	config.pass = options.pass;
	config.uv_mode = static_cast<WP2::EncoderConfig::UVMode>(options.uv_mode);
	config.csp_type = static_cast<WP2::Csp>(options.csp_type);
	config.sns = options.sns;
	config.error_diffusion = options.error_diffusion;
	config.use_random_matrix = options.use_random_matrix;

	auto buffer = (uint8_t *)input.c_str();
	WP2::ArgbBuffer src = WP2::ArgbBuffer();

	// Format. WP2_RGBA_32 is the same but NOT premultiplied alpha
	WP2Status status = src.Import(WP2_rgbA_32, width, height, buffer, CHANNELS_RGB * width);
	if (status != WP2_STATUS_OK)
	{
		return val::null();
	}

	WP2::MemoryWriter memory_writer;
	// In WebP2, thread_level is number of *extra* threads to use (0 for no multithreading).
	// config.thread_level = emscripten_num_logical_cores() - 1;
	status = WP2::Encode(src, &memory_writer, config);
	if (status != WP2_STATUS_OK)
	{
		return val::null();
	}
	return toUint8Array(memory_writer.mem_, memory_writer.size_);
}

EMSCRIPTEN_BINDINGS(icodec_module_WebP2)
{
	function("encode", &encode);

	value_object<WP2Options>("WP2Options")
		.field("quality", &WP2Options::quality)
		.field("alpha_quality", &WP2Options::alpha_quality)
		.field("effort", &WP2Options::effort)
		.field("pass", &WP2Options::pass)
		.field("uv_mode", &WP2Options::uv_mode)
		.field("csp_type", &WP2Options::csp_type)
		.field("error_diffusion", &WP2Options::error_diffusion)
		.field("use_random_matrix", &WP2Options::use_random_matrix)
		.field("sns", &WP2Options::sns);
}
