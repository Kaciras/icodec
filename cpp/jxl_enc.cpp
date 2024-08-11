#include <emscripten/bind.h>
#include <emscripten/val.h>

#include "icodec.h"
#include "lib/jxl/base/thread_pool_internal.h"
#include "lib/jxl/enc_external_image.h"
#include "lib/jxl/enc_file.h"
#include "lib/jxl/enc_color_management.h"

using namespace emscripten;
using namespace jxl;

struct JXLOptions
{
	bool lossless;
	float quality;
	int effort;
	bool progressive;
	int epf;
	bool lossyPalette;
	size_t decodingSpeedTier;
	float photonNoiseIso;
	bool lossyModular;
};

val encode(std::string pixels, size_t width, size_t height, JXLOptions options)
{
	static const JxlPixelFormat format = {CHANNELS_RGB, JXL_TYPE_UINT8, JXL_LITTLE_ENDIAN, 0};

	CompressParams cparams;
	PassesEncoderState passes_enc_state;
	CodecInOut io;
	PaddedBytes bytes;
	ImageBundle *main = &io.Main();

	cparams.speed_tier = SpeedTier(10 - options.effort);
	cparams.epf = options.epf;
	cparams.decoding_speed_tier = options.decodingSpeedTier;
	cparams.photon_noise_iso = options.photonNoiseIso;

	if (options.lossyPalette)
	{
		cparams.lossy_palette = true;
		cparams.palette_colors = 0;
		cparams.options.predictor = Predictor::Zero;
		// Near-lossless assumes -R 0
		cparams.responsive = 0;
		cparams.modular_mode = true;
	}

	float quality = options.quality;

	// Quality settings roughly match libjpeg qualities.
	if (options.lossyModular || quality == 100)
	{
		cparams.modular_mode = true;
	}
	else
	{
		cparams.modular_mode = false;
		if (quality >= 30)
		{
			cparams.butteraugli_distance = 0.1 + (100 - quality) * 0.09;
		}
		else
		{
			cparams.butteraugli_distance = 6.4 + pow(2.5, (30 - quality) / 5.0f) / 6.25f;
		}
	}

	if (options.progressive)
	{
		cparams.qprogressive_mode = true;
		cparams.responsive = 1;
		if (!cparams.modular_mode)
		{
			cparams.progressive_dc = 1;
		}
	}

	if (options.lossless)
	{
		cparams.SetLossless();
	}

	io.metadata.m.SetAlphaBits(8);
	if (!io.metadata.size.Set(width, height))
	{
		return val("jxl::SizeHeader::Set");
	}

	auto inBuffer = reinterpret_cast<const uint8_t *>(pixels.data());
	auto span = Span(inBuffer, pixels.size());

	auto status = ConvertFromExternal(
		span, width, height,
		ColorEncoding::SRGB(false),
		8, format, nullptr, main
	);
	if (!status)
	{
		return val("jxl::ConvertFromExternal");
	}

	status = EncodeFile(cparams, &io, &passes_enc_state, &bytes, GetJxlCms(), nullptr, nullptr);
	if (!status)
	{
		return val("jxl::EncodeFile");
	}
	return toUint8Array(bytes.data(), bytes.size());
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
