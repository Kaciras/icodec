#include <emscripten/bind.h>
#include "icodec.h"
#include "avif/avif.h"

#define CHECK_STATUS(s) if (s != AVIF_RESULT_OK)	\
{													\
	return val(avifResultToString(s));				\
}

#define SET_OPTION(key, value) \
	CHECK_STATUS(avifEncoderSetCodecSpecificOption(encoder.get(), key, value))

struct AvifOptions
{
	int quality;
	int qualityAlpha;
	bool autoTiling;
	int tileRowsLog2;
	int tileColsLog2;
	int speed;
	int subsample;
	bool chromaDeltaQ;
	int sharpness;
	int tune;
	int denoiseLevel;
	bool sharpYUV;
};

/**
 * AVIF encode. Implementation reference:
 * https://github.com/AOMediaCodec/libavif/blob/main/examples/avif_example_encode.c
 * https://github.com/AOMediaCodec/libavif/blob/main/apps/avifenc.c
 */
val encode(std::string pixels, uint32_t width, uint32_t height, AvifOptions options)
{
	auto format = (avifPixelFormat)options.subsample;

	// Smart pointer for the input image in YUV format
	auto image = toRAII(avifImageCreate(width, height, COLOR_DEPTH, format), avifImageDestroy);
	if (image == nullptr)
	{
		return val("Out of memory");
	}

	if (options.qualityAlpha == -1)
	{
		options.qualityAlpha = options.quality;
	}

	// `matrixCoefficients` must set to identity for lossless.
	if (options.quality == AVIF_QUALITY_LOSSLESS &&
		options.qualityAlpha == AVIF_QUALITY_LOSSLESS &&
		format == AVIF_PIXEL_FORMAT_YUV444)
	{
		image->matrixCoefficients = AVIF_MATRIX_COEFFICIENTS_IDENTITY;
	}
	else
	{
		image->matrixCoefficients = AVIF_MATRIX_COEFFICIENTS_BT601;
	}

	// Convert our RGBA format image to libavif internal YUV structure.
	avifRGBImage srcRGB;
	avifRGBImageSetDefaults(&srcRGB, image.get());
	srcRGB.pixels = reinterpret_cast<uint8_t *>(pixels.data());
	srcRGB.rowBytes = width * CHANNELS_RGBA;
	if (options.sharpYUV)
	{
		srcRGB.chromaDownsampling = AVIF_CHROMA_DOWNSAMPLING_SHARP_YUV;
	}

	CHECK_STATUS(avifImageRGBToYUV(image.get(), &srcRGB));

	// Create a smart pointer for the encoder
	auto encoder = toRAII(avifEncoderCreate(), avifEncoderDestroy);
	if (encoder == nullptr)
	{
		return val("Out of memory");
	}
	encoder->quality = options.quality;
	encoder->qualityAlpha = options.qualityAlpha;
	encoder->speed = options.speed;
	encoder->autoTiling = options.autoTiling;
	encoder->tileRowsLog2 = options.tileRowsLog2;
	encoder->tileColsLog2 = options.tileColsLog2;

	// https://github.com/AOMediaCodec/libavif/blob/47f154ae4cdefbdb7f9d86c0017acfe118db260e/src/codec_aom.c#L404
	// aq-mode has no effect, cq-level overrides quality.
	SET_OPTION("sharpness", std::to_string(options.sharpness).c_str());
	SET_OPTION("color:denoise-noise-level", std::to_string(options.denoiseLevel).c_str());

	if (options.tune == 2 || (options.tune == 0 && options.quality >= 50))
	{
		SET_OPTION("tune", "ssim");
	}
	if (options.chromaDeltaQ)
	{
		SET_OPTION("color:enable-chroma-deltaq", "1");
	}

	avifRWData output = AVIF_DATA_EMPTY;
	CHECK_STATUS(avifEncoderWrite(encoder.get(), image.get(), &output));

	auto _ = toRAII(&output, avifRWDataFree);
	return toUint8Array(output.data, output.size);
}

EMSCRIPTEN_BINDINGS(icodec_module_AVIF)
{
	function("encode", &encode);

	value_object<AvifOptions>("AvifOptions")
		.field("quality", &AvifOptions::quality)
		.field("qualityAlpha", &AvifOptions::qualityAlpha)
		.field("tileRowsLog2", &AvifOptions::tileRowsLog2)
		.field("tileColsLog2", &AvifOptions::tileColsLog2)
		.field("autoTiling", &AvifOptions::autoTiling)
		.field("speed", &AvifOptions::speed)
		.field("chromaDeltaQ", &AvifOptions::chromaDeltaQ)
		.field("sharpness", &AvifOptions::sharpness)
		.field("tune", &AvifOptions::tune)
		.field("denoiseLevel", &AvifOptions::denoiseLevel)
		.field("subsample", &AvifOptions::subsample)
		.field("sharpYUV", &AvifOptions::sharpYUV);
}
