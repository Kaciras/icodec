import * as codecs from "../lib/index.js";

self.addEventListener("message", async event => {
	const [codec, image, options] = event.data;
	const encoder = codecs[codec];

	await encoder.loadEncoder();
	const result = encoder.encode(image, options);
	self.postMessage(result, [result.buffer]);
});
