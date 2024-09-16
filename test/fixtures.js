import { createWriteStream, readFileSync, writeFileSync } from "node:fs";
import assert from "node:assert";
import { once } from "node:events";
import { getCached } from "@kaciras/utilities/browser";
import sharp from "sharp";
import pixelMatch from "pixelmatch";
import { toBitDepth } from "../lib/common.js";

const directory = `${import.meta.dirname}/snapshot`;
const cache = new Map();

Error.stackTraceLimit = Infinity;

// A simple format, 4 bytes width + 4 bytes height + 4 bytes depth + RGBA data.
function readBin(path) {
	const data = readFileSync(path);
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
	return getCached(cache, `${directory}/${name}.bin`, readBin);
}

export function getSnapshot(name, codec) {
	const path = `${directory}/${name}.${codec.extension}`;
	return getCached(cache, path, readFileSync);
}

/**
 * Since the results of lossy conversions may change as the encoder is updated,
 * we do not compare snapshots; they are only used to judge quality.
 */
export function updateSnapshot(name, codec, data) {
	name = `${directory}/${name}.${codec.extension}`;
	cache.set(name, data);
	writeFileSync(name, data);
}

/**
 * Create new image from input with alpha channel set to opaque. only support 8-bit depth.
 */
export function makeOpaque(image) {
	const { width, height, data } = image;
	const opacity = data.slice();
	for (let i = 3; i < opacity.length; i += 4) {
		opacity[i] = 255;
	}
	return _icodec_ImageData(opacity, width, height, 8);
}

export function generateTestImage(depth) {
	const length = 16 * 16 * 4;
	const data = depth === 8 ? new Uint8Array(length) : new Uint16Array(length);
	const max = (1 << depth) - 1;
	const step = (1 << depth) / 256;

	for (let i = 0, v = 0; i < 256; i++, v += step) {
		data[i * 4] = max - v;
		data[i * 4 + 2] = v;
		data[i * 4 + 3] = max - v;
	}
	const u8 = new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength);
	return _icodec_ImageData(u8, 16, 16, depth);
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
	const { width, height, data } = toBitDepth(expected, 8);
	actual = toBitDepth(actual, 8);
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
