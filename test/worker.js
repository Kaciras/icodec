import * as codecs from "../lib/index.js";

self.addEventListener("message", async event => {
	const [codec, image, options] = event.data;
	const encoder = codecs[codec];
	try {
		await encoder.loadEncoder();
		const output = encoder.encode(image, options);
		postMessage(output, [output.buffer]);
	} catch (e) {
		console.error(e);
		postMessage({ error: e.message, stack: e.stack });
	}
});
