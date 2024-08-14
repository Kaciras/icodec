#include <emscripten/val.h>

using namespace emscripten;

// The target platform is the browser, which does not yet support 10 bit color.
#define COLOR_DEPTH 8

// We want RGBA bytes in raw image data.
#define CHANNELS_RGBA 4

thread_local const val Uint8Array = val::global("Uint8Array");
thread_local const val Uint8ClampedArray = val::global("Uint8ClampedArray");
thread_local const val ImageData = val::global("_ICodec_ImageData");

template <typename T, typename Deletion>
std::unique_ptr<T, Deletion> toRAII(T *pointer, Deletion deletion)
{
	return { pointer, deletion };
}

val toImageData(const uint8_t *bytes, uint32_t width, uint32_t height)
{
	auto length = ((size_t)CHANNELS_RGBA) * width * height;
	auto view = typed_memory_view(length, bytes);
	auto data = Uint8ClampedArray.new_(view);
	return ImageData.new_(data, width, height);
}

val toUint8Array(uint8_t *bytes, size_t length)
{
	return Uint8Array.new_(typed_memory_view(length, bytes));
}
