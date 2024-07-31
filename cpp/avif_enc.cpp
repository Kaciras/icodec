#include <memory>
#include <string>
#include <emscripten/bind.h>
#include <emscripten/threading.h>
#include <emscripten/val.h>
#include "icodec.h"
#include "avif/avif.h"

using namespace emscripten;

using AvifEncoderPtr = std::unique_ptr<avifEncoder, decltype(&avifEncoderDestroy)>;

struct AvifOptions
{
	int quality;
	int qualityAlpha;
	int tileRowsLog2;
	int tileColsLog2;
	int speed;
	int subsample;
	bool chromaDeltaQ;
	int sharpness;
	int tune;
	int denoiseLevel;
	bool enableSharpYUV;
};

val encode(std::string input, int width, int height, AvifOptions options)
{
	avifResult status; // To check the return status for avif API's

	if (options.qualityAlpha == -1)
	{
		options.qualityAlpha = options.quality;
	}

	auto format = (avifPixelFormat)options.subsample;

	auto lossless = options.quality == AVIF_QUALITY_LOSSLESS &&
					options.qualityAlpha == AVIF_QUALITY_LOSSLESS &&
					format == AVIF_PIXEL_FORMAT_YUV444;

	// Smart pointer for the input image in YUV format
	auto image = toRAII(avifImageCreate(width, height, COLOR_DEPTH, format), avifImageDestroy);
	if (image == nullptr)
	{
		return val("Out of memory");
	}

	if (lossless)
	{
		image->matrixCoefficients = AVIF_MATRIX_COEFFICIENTS_IDENTITY;
	}
	else
	{
		image->matrixCoefficients = AVIF_MATRIX_COEFFICIENTS_BT601;
	}

	avifRGBImage srcRGB;
	avifRGBImageSetDefaults(&srcRGB, image.get());
	srcRGB.pixels = reinterpret_cast<uint8_t *>(input.data());
	srcRGB.rowBytes = width * CHANNELS_RGB;
	if (options.enableSharpYUV)
	{
		srcRGB.chromaDownsampling = AVIF_CHROMA_DOWNSAMPLING_SHARP_YUV;
	}

	status = avifImageRGBToYUV(image.get(), &srcRGB);
	if (status != AVIF_RESULT_OK)
	{
		return val(avifResultToString(status));
	}

	// Create a smart pointer for the encoder
	auto encoder = toRAII(avifEncoderCreate(), avifEncoderDestroy);
	if (image == nullptr)
	{
		return val("Out of memory");
	}

	if (lossless)
	{
		encoder->quality = AVIF_QUALITY_LOSSLESS;
		encoder->qualityAlpha = AVIF_QUALITY_LOSSLESS;
	}
	else
	{
		status = avifEncoderSetCodecSpecificOption(encoder.get(), "sharpness", std::to_string(options.sharpness).c_str());
		if (status != AVIF_RESULT_OK)
		{
			return val(avifResultToString(status));
		}

		encoder->quality = options.quality;
		encoder->qualityAlpha = options.qualityAlpha;

		if (options.tune == 2 || (options.tune == 0 && options.quality >= 50))
		{
			status = avifEncoderSetCodecSpecificOption(encoder.get(), "tune", "ssim");
			if (status != AVIF_RESULT_OK)
			{
				return val(avifResultToString(status));
			}
		}

		if (options.chromaDeltaQ)
		{
			status = avifEncoderSetCodecSpecificOption(encoder.get(), "color:enable-chroma-deltaq", "1");
			if (status != AVIF_RESULT_OK)
			{
				return val(avifResultToString(status));
			}
		}

		status = avifEncoderSetCodecSpecificOption(encoder.get(), "color:denoise-noise-level", std::to_string(options.denoiseLevel).c_str());
		if (status != AVIF_RESULT_OK)
		{
			return val(avifResultToString(status));
		}
	}

	encoder->maxThreads = 1;
	encoder->tileRowsLog2 = options.tileRowsLog2;
	encoder->tileColsLog2 = options.tileColsLog2;
	encoder->speed = options.speed;

	avifRWData output = AVIF_DATA_EMPTY;
	status = avifEncoderWrite(encoder.get(), image.get(), &output);
	if (status != AVIF_RESULT_OK)
	{
		return val(avifResultToString(status));
	}

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
		.field("speed", &AvifOptions::speed)
		.field("chromaDeltaQ", &AvifOptions::chromaDeltaQ)
		.field("sharpness", &AvifOptions::sharpness)
		.field("tune", &AvifOptions::tune)
		.field("denoiseLevel", &AvifOptions::denoiseLevel)
		.field("subsample", &AvifOptions::subsample)
		.field("enableSharpYUV", &AvifOptions::enableSharpYUV);
}
