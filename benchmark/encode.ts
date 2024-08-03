import { readFileSync } from "fs";
import sharp, { Sharp, SharpOptions } from "sharp";
import { defineSuite } from "esbench";
import * as codecs from "../lib/node.js";

const sharpOptions: SharpOptions = { raw: { width: 417, height: 114, channels: 4 } };

const rgbaFixture = {
	width: 417,
	height: 114,
	data: readFileSync("test/snapshot/image.bin"),
};

const sharpEncodes: Record<string, (image: Sharp) => Sharp> = {
	avif: image => image.avif(),
	jpeg: image => image.jpeg(),
	png: image => image.png({ quality: 75, palette: true }),
	// jxl: image => image.jxl(),
	webp: image => image.webp(),
};

const encoders = Object.keys(codecs).filter(k => codecs[k as keyof typeof codecs].encode);

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
			scene.benchAsync("Sharp", () => sharpEncode(sharp(rgbaFixture.data, sharpOptions)).toBuffer());
		}
	},
});
