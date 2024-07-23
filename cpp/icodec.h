#include <emscripten/val.h>

using namespace emscripten;

thread_local const val Uint8Array = val::global("Uint8Array");
thread_local const val Uint8ClampedArray = val::global("Uint8ClampedArray");
thread_local const val ImageData = val::global("_ICODEC_ImageData");

template <typename T, typename Deletion>
std::unique_ptr<T, Deletion> toRAII(T *pointer, Deletion deletion)
{
	return { pointer, deletion };
}

val toImageData(uint8_t *rgba, size_t width, size_t height)
{
	auto length = width * height * 4;
	auto view = typed_memory_view(4 * width * height, rgba);
	auto data = Uint8ClampedArray.new_(view);
	return ImageData.new_(data, width, height);
}

val toUint8(uint8_t *bytes, size_t length)
{
	return Uint8Array.new_(typed_memory_view(length, (const uint8_t *)bytes));
}
