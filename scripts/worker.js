import { RPC } from "../node_modules/@kaciras/utilities/lib/browser.js";
import * as codecs from "../lib/index.js";

async function encode(codec, image, options) {
	const encoder = codecs[codec];
	await encoder.loadEncoder();
	const output = encoder.encode(image, options);
	return RPC.transfer(output, [output.buffer]);
}

RPC.probeServer({ encode }, self);
