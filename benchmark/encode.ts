import { readFileSync } from "fs";
import sharp, { Sharp, SharpOptions } from "sharp";
import { defineSuite } from "esbench";
import * as codecs from "../lib/node.js";

const sharpOptions: SharpOptions = { raw: { width: 417, height: 114, channels: 4 } };
const bytes = readFileSync("test/snapshot/image.bin");

const sharpEncode: Record<string, (image: Sharp) => Sharp> = {
	avif: image => image.avif(),
	jpeg: image => image.jpeg(),
	png: image => image.png({ quality: 75, palette: true }),
	jxl: image => image.jxl(),
	webp: image => image.webp(),
};

export default defineSuite({
	params: {
		codec: ["avif", "jpeg", "png", "webp"],
	},
	baseline: {
		type: "Name",
		value: "Sharp",
	},
	async setup(scene) {
		const name = scene.params.codec;
		const { loadEncoder, encode } = codecs[name];
		await loadEncoder();

		scene.bench("WASM", () => encode(bytes, 417, 114));
		scene.benchAsync("Sharp", () => sharpEncode[name](sharp(bytes, sharpOptions)).toBuffer());
	},
});
