import * as codecs from "../lib/index.js";

async function encode(args) {
	const [codec, image, options] = args;
	const encoder = codecs[codec];
	await encoder.loadEncoder();

	const rich = _icodec_ImageData(image.data, image.width, image.height, image.depth);
	const output = encoder.encode(rich, options);

	postMessage(output, [output.buffer]);
}

/**
 * Must post the error to main thread to print,
 * as `console` behaves strangely in workers.
 *
 * https://stackoverflow.com/a/24284796/7065321
 */
self.addEventListener("message", event => {
	encode(event.data).catch(postMessage);
});
