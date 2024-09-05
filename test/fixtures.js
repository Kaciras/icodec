import { createWriteStream, readFileSync, writeFileSync } from "node:fs";
import assert from "node:assert";
import { once } from "node:events";
import sharp from "sharp";
import pixelMatch from "pixelmatch";

const directory = `${import.meta.dirname}/snapshot`;
const cache = new Map();

Error.stackTraceLimit = Infinity;

// A simple format, 4 bytes width + 4 bytes height + 4 bytes depth + RGBA data.
function decodeBin(data) {
	const { buffer, byteOffset } = data;
	const [width, height, depth] = new Uint32Array(buffer, byteOffset);
	return _icodec_ImageData(data.subarray(12), width, height, depth);
}

export function writeBin(name, image) {
	const header = new Uint32Array(3);
	header[0] = image.width;
	header[1] = image.height;
	header[2] = image.depth;

	const stream = createWriteStream(name);
	stream.write(header);
	stream.write(image.data);
	return once(stream, "finish");
}

/**
 * Read a *.bin file in snapshot directory.
 * These files are original image and used as encode input.
 *
 * @param name File name without extension.
 * @return {ImageDataLike} The image data.
 */
export function getRawPixels(name) {
	const path = `${directory}/${name}.bin`;
	let image = cache.get(path);
	if (image) {
		return image;
	}
	image = decodeBin(readFileSync(path));
	return cache.set(name, image) && image;
}

export function getSnapshot(name, codec) {
	name = `${name}.${codec.extension}`;
	let item = cache.get(name);
	if (item) {
		return item;
	}
	item = readFileSync(`${directory}/${name}`);
	return cache.set(name, item) && item;
}

/**
 * Since the results of lossy conversions may change as the encoder is updated,
 * we do not compare snapshots; they are only used to judge quality.
 */
export function updateSnapshot(name, codec, data) {
	name = `${name}.${codec.extension}`;
	cache.set(name, data);
	writeFileSync(`${directory}/${name}`, data);
}

function savePNG(width, height, data, filename) {
	const raw = { width, height, channels: 4 };
	// noinspection JSIgnoredPromiseFromCall: No need to wait.
	sharp(data, { raw }).png().toFile(filename);
}

/**
 * Asserts that the two images are similar, that they have the same dimensions,
 * and that the differences in content are within specified limits.
 *
 * Set `toleration` & `threshold` to 0 to assert pixels are equal.
 *
 * @param expected Image data of the images to compare.
 * @param actual Image data of the images to compare.
 * @param threshold From 0 to 1. Smaller values make the comparison more sensitive.
 * @param toleration If different pixels percentage greater than it, the assertion failed.
 */
export function assertSimilar(expected, actual, threshold, toleration) {
	const { width, height, data } = expected;
	assert.strictEqual(actual.width, width);
	assert.strictEqual(actual.height, height);

	const map = new Uint8ClampedArray(width * height * 4);
	const diffs = pixelMatch(data, actual.data, map, width, height, { threshold });

	if (diffs > width * height * toleration) {
		savePNG(width, height, actual.data, "output.png");
		savePNG(width, height, map, "diff.png");
		assert.fail("Output pixels is not similar, see diff.png for details");
	}
}
