import { defineSuite } from "esbench";

const codecs = typeof window === "undefined"
	? await import("../lib/node.js")
	: await import("../lib/index.js");

const codecNames = Object.keys(codecs).filter(k => codecs[k as keyof typeof codecs].decode);

// Node: retrieve pixels with 2d context is lossy due to alpha premultiply.
async function extract2D(this: HTMLCanvasElement, bitmap: ImageBitmap) {
	const { width, height } = bitmap;
	this.width = width;
	this.height = height;

	const ctx = this.getContext("2d")!;
	ctx.drawImage(bitmap, 0, 0);
	return ctx.getImageData(0, 0, width, height);
}

// https://stackoverflow.com/a/60564905/7065321
async function extractWebGL(this: HTMLCanvasElement, bitmap: ImageBitmap) {
	const gl = this.getContext("webgl2")!;
	const { width, height } = bitmap;

	gl.activeTexture(gl.TEXTURE0);
	const texture = gl.createTexture();
	gl.bindTexture(gl.TEXTURE_2D, texture);
	const framebuffer = gl.createFramebuffer();
	gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
	gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, bitmap);
	gl.drawBuffers([gl.NONE]);

	const data = new Uint8ClampedArray(width * height * 4);
	gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, data);
	return new ImageData(data, width, height);
}

function browserDecode(blob: Blob, extract: typeof extract2D) {
	return createImageBitmap(blob, { premultiplyAlpha: "none" }).then(extract);
}

/*
 * Run benchmark on Node:
 *     `pnpm exec esbench --file decode.ts --executor in-process`
 *
 * Run benchmark on browser:
 *     `set NODE_OPTIONS=--experimental-import-meta-resolve`
 *     `pnpm exec esbench --file decode.ts --executor web`
 */
export default defineSuite({
	params: {
		codec: codecNames,
	},
	baseline: {
		type: "Name",
		value: "icodec",
	},
	async setup(scene) {
		const name = scene.params.codec as keyof typeof codecs;
		const { loadDecoder, decode, extension } = codecs[name];
		await loadDecoder();

		if (typeof window === "undefined") {
			const { default: sharp } = await import("sharp");
			const { readFileSync } = await import("fs");

			const input = readFileSync(`test/snapshot/image.${extension}`);
			const instance = sharp(input);

			scene.bench("icodec", () => decode(input));

			if (name in instance && name !== "jxl") {
				scene.benchAsync("Sharp", () => instance.raw().toBuffer());
			}
		} else {
			const response = await fetch(`test/snapshot/image.${extension}`);
			const blob = await response.blob();
			scene.benchAsync("icodec", async () => decode(new Uint8Array(await blob.arrayBuffer())));

			const _2d = extract2D.bind(document.createElement("canvas"));
			const gl2 = extractWebGL.bind(document.createElement("canvas"));

			try {
				await browserDecode(blob, _2d);
				scene.benchAsync("2d", () => browserDecode(blob, _2d));
				scene.benchAsync("WebGL", () => browserDecode(blob, gl2));
			} catch {
				// Browser does not support decode that format, skip.
			}
		}
	},
});
