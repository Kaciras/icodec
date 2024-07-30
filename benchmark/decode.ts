import { defineSuite } from "esbench";
import { readFileSync } from "fs";
import sharp from "sharp";
import * as codecs from "../lib/node.js";

export default defineSuite({
	params: {
		codec: ["avif", "webp"],
	},
	baseline: {
		type: "Name",
		value: "Sharp",
	},
	async setup(scene) {
		const name = scene.params.codec;
		const { loadDecoder, decode, extension } = codecs[name];
		await loadDecoder();

		const input = readFileSync(`test/snapshot/image.${extension}`);

		scene.bench("WASM", () => decode(input));
		scene.benchAsync("Sharp", () => sharp(input).raw().toBuffer());
	},
});
