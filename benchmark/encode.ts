import { getRawPixels } from "../test/fixtures.js";
import { defineSuite } from "esbench";
import sharp, { Sharp } from "sharp";
import * as codecs from "../lib/node.js";

const input = getRawPixels("image");

const sharpImage = sharp(input.data, {
	raw: {
		channels: 4,
		width: input.width,
		height: input.height,
	},
});

const sharpEncodes: Record<string, () => Sharp> = {
	avif: () => sharpImage.avif(),
	jpeg: () => sharpImage.jpeg(),
	png: () => sharpImage.png({ quality: 75, palette: true }),
	// jxl: () => sharpImage.jxl(),14,656,268 bytes
	webp: () => sharpImage.webp(),
};

const encoders = Object.keys(codecs).filter(k => codecs[k as keyof typeof codecs].encode);

encoders.splice(encoders.indexOf("heic"), 1);

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

		scene.bench("WASM", () => encode(input));
		if (sharpEncode) {
			scene.benchAsync("Sharp", () => sharpEncode().toBuffer());
		}
	},
});
