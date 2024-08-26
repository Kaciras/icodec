import { readFileSync, writeFileSync } from "node:fs";
import assert from "node:assert";
import sharp from "sharp";
import pixelMatch from "pixelmatch";

const directory = `${import.meta.dirname}/snapshot`;
const cache = new Map();

// A simple format, 4-bytes width + 4-bytes height + RGBA data.
function decodeBin(bytes) {
	const view = new DataView(bytes.buffer, bytes.byteOffset);
	const width = view.getUint32(0);
	const height = view.getUint32(4);
	return { width, height, data: bytes.subarray(8) };
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
		// noinspection JSIgnoredPromiseFromCall: No need to wait.
		sharp(map, { raw: { width, height, channels: 4 } })
			.png()
			.toFile("diff.png");
		assert.fail("Output pixels is not similar, see diff.png for details");
	}
}
