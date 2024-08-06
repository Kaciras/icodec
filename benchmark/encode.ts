import { readFileSync } from "fs";
import sharp, { Sharp } from "sharp";
import { defineSuite } from "esbench";
import * as codecs from "../lib/node.js";

const rgbaFixture = {
	width: 417,
	height: 114,
	data: readFileSync("test/snapshot/image.bin"),
};

const sharpImage = sharp(rgbaFixture.data, {
	raw: { width: 417, height: 114, channels: 4 },
});

const sharpEncodes: Record<string, () => Sharp> = {
	avif: () => sharpImage.avif(),
	jpeg: () => sharpImage.jpeg(),
	png: () => sharpImage.png({ quality: 75, palette: true }),
	// jxl: () => sharpImage.jxl(),14,656,268 bytes
	webp: () => sharpImage.webp(),
};

const encoders = Object.keys(codecs).filter(k => codecs[k as keyof typeof codecs].encode);

// pnpm exec esbench --file encode.ts
export default defineSuite({
	params: {
		codec: encoders,
	},
	baseline: {
		type: "Name",
		value: "Sharp",
	},
	async setup(scene) {
		const name = scene.params.codec as keyof typeof codecs;
		const sharpEncode = sharpEncodes[name];
		const { loadEncoder, encode } = codecs[name];

		await loadEncoder();

		scene.bench("WASM", () => encode(rgbaFixture));
		if (sharpEncode) {
			scene.benchAsync("Sharp", () => sharpEncode().toBuffer());
		}
	},
});
