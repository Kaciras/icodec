import { readFileSync, writeFileSync } from "fs";
import assert from "assert";
import pixelMatch from "pixelmatch";
import sharp from "sharp";

// Absolute path is ImageData, relative path is snapshot.
const cache = new Map();

// A simple format, 4-bytes width + 4-bytes height + RGBA data.
function decodeBin(bytes) {
	const view = new DataView(bytes.buffer, bytes.byteOffset);
	const width = view.getUint32(0);
	const height = view.getUint32(4);
	return { width, height, data: bytes.subarray(8) };
}

export function getRawPixels(name) {
	const path = `${import.meta.dirname}/snapshot/${name}.bin`;
	let image = cache.get(name);
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
	const path = `${import.meta.dirname}/snapshot/${name}`;
	item = readFileSync(path);
	return cache.set(name, item) && item;
}

export function updateSnapshot(name, codec, data) {
	name = `${name}.${codec.extension}`;
	cache.set(name, data);
	writeFileSync(`${import.meta.dirname}/snapshot/${name}`, data);
}

export function assertSimilar(expected, actual, toleration, threshold) {
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
