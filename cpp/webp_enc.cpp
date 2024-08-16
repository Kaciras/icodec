#include <emscripten/bind.h>
#include <emscripten/val.h>
#include <stdlib.h>
#include <string.h>
#include <stdexcept>
#include "src/webp/encode.h"
#include "icodec.h"

using namespace emscripten;

val encode(std::string pixels, int width, int height, WebPConfig config)
{
	auto rgba = reinterpret_cast<uint8_t *>(pixels.data());
	WebPPicture pic;
	WebPMemoryWriter writer;

	if (!WebPPictureInit(&pic))
	{
		// shouldn't happen, except if system installation is broken
		return val("WebPPictureInit");
	}

	// Allow quality to go higher than 0.
	config.qmax = 100;

	// Only use use_argb if we really need it, as it's slower.
	pic.use_argb = config.lossless || config.use_sharp_yuv || config.preprocessing > 0;
	pic.width = width;
	pic.height = height;
	pic.writer = WebPMemoryWrite;
	pic.custom_ptr = &writer;

	WebPMemoryWriterInit(&writer);

	auto stride = width * CHANNELS_RGBA;
	int ok = WebPPictureImportRGBA(&pic, rgba, stride) && WebPEncode(&config, &pic);
	WebPPictureFree(&pic);

	auto _ = toRAII(&writer, WebPMemoryWriterClear);
	return ok ? toUint8Array(writer.mem, writer.size) : val("WebPEncode");
}

EMSCRIPTEN_BINDINGS(icodec_module_WebP)
{
	function("encode", &encode);

	enum_<WebPImageHint>("WebPImageHint")
		.value("WEBP_HINT_DEFAULT", WebPImageHint::WEBP_HINT_DEFAULT)
		.value("WEBP_HINT_PICTURE", WebPImageHint::WEBP_HINT_PICTURE)
		.value("WEBP_HINT_PHOTO", WebPImageHint::WEBP_HINT_PHOTO)
		.value("WEBP_HINT_GRAPH", WebPImageHint::WEBP_HINT_GRAPH);

	value_object<WebPConfig>("WebPConfig")
		.field("lossless", &WebPConfig::lossless)
		.field("quality", &WebPConfig::quality)
		.field("method", &WebPConfig::method)
		.field("imageHint", &WebPConfig::image_hint)
		.field("targetSize", &WebPConfig::target_size)
		.field("targetPSNR", &WebPConfig::target_PSNR)
		.field("segments", &WebPConfig::segments)
		.field("snsStrength", &WebPConfig::sns_strength)
		.field("filterStrength", &WebPConfig::filter_strength)
		.field("filterSharpness", &WebPConfig::filter_sharpness)
		.field("filterType", &WebPConfig::filter_type)
		.field("autofilter", &WebPConfig::autofilter)
		.field("alphaCompression", &WebPConfig::alpha_compression)
		.field("alphaFiltering", &WebPConfig::alpha_filtering)
		.field("alphaQuality", &WebPConfig::alpha_quality)
		.field("pass", &WebPConfig::pass)
		.field("showCompressed", &WebPConfig::show_compressed)
		.field("preprocessing", &WebPConfig::preprocessing)
		.field("partitions", &WebPConfig::partitions)
		.field("partitionLimit", &WebPConfig::partition_limit)
		.field("emulateJpegSize", &WebPConfig::emulate_jpeg_size)
		.field("lowMemory", &WebPConfig::low_memory)
		.field("nearLossless", &WebPConfig::near_lossless)
		.field("exact", &WebPConfig::exact)
		.field("useDeltaPalette", &WebPConfig::use_delta_palette)
		.field("useSharpYUV", &WebPConfig::use_sharp_yuv);
}
