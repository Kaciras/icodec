import { defineSuite } from "esbench";
import { readFileSync } from "fs";
import sharp from "sharp";
import * as codecs from "../lib/node.js";

const decoders = Object.keys(codecs).filter(k => codecs[k as keyof typeof codecs].decode);

export default defineSuite({
	params: {
		codec: decoders,
	},
	baseline: {
		type: "Name",
		value: "Sharp",
	},
	async setup(scene) {
		const name = scene.params.codec as keyof typeof codecs;
		const { loadDecoder, decode, extension } = codecs[name];
		await loadDecoder();

		const input = readFileSync(`test/snapshot/image.${extension}`);

		scene.bench("WASM", () => decode(input));

		if (name in sharp(input) && name !== "jxl") {
			scene.benchAsync("Sharp", () => sharp(input).raw().toBuffer());
		}
	},
});
