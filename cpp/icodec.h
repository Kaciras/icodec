#include <emscripten/val.h>

using namespace emscripten;

// The target platform is the browser, which does not yet support 10 bit color.
#define COLOR_DEPTH 8

// We want RGBA bytes in raw image data.
#define CHANNELS_RGBA 4

thread_local const val Uint8Array = val::global("Uint8Array");
thread_local const val Uint8ClampedArray = val::global("Uint8ClampedArray");
thread_local const val _icodec_ImageData = val::global("_icodec_ImageData");

/*!
 * Use RAII to avoid forgetting to release and make the code cleaner.
 *
 * https://stackoverflow.com/a/39176806/7065321
 *
 * @param pointer Pointer of the object to be managed.
 * @param deletion The destroy function of the pointer.
 */
template <typename T, typename Deletion>
std::unique_ptr<T, Deletion> toRAII(T *pointer, Deletion deletion)
{
	return {pointer, deletion};
}

/*!
 * Convert the buffer to JS ImageDataLike object, data are copied.
 *
 * JS entries must set `_icodec_ImageData` global variable,
 * in browsers it is the builtin `ImageData` and in Node it is a custom class.
 *
 * @param bytes A buffer containing the underlying pixel representation of the image.
 * @param width An unsigned long representing the width of the image.
 * @param width An unsigned long representing the height of the image.
 */
val toImageData(const uint8_t *bytes, uint32_t width, uint32_t height, uint32_t depth)
{
	auto length = ((size_t)CHANNELS_RGBA) * width * height * ((depth + 7) / 8);
	auto view = typed_memory_view(length, bytes);
	auto data = Uint8ClampedArray.new_(view);
	return _icodec_ImageData(data, width, height, depth);
}

/*!
 * Convert the buffer to JS Uint8Array object, data are copied.
 */
val toUint8Array(const uint8_t *bytes, size_t length)
{
	return Uint8Array.new_(typed_memory_view(length, bytes));
}
