import { defineSuite } from "esbench";

const codecs = typeof window === "undefined"
	? await import("../lib/node.js")
	: await import("../lib/index.js");

const decoders = Object.keys(codecs).filter(k => codecs[k as keyof typeof codecs].decode);

function browserDecode(blob: Blob, extract: any) {
	return createImageBitmap(blob, { premultiplyAlpha: "none" }).then(extract);
}

// Node: retrieve pixels with 2d context is lossy due to alpha premultiply.
async function extract2D(bitmap: ImageBitmap) {
	const { width, height } = bitmap;
	const canvas = document.createElement("canvas");
	canvas.width = width;
	canvas.height = height;

	const ctx = canvas.getContext("2d")!;
	ctx.drawImage(bitmap, 0, 0);
	return ctx.getImageData(0, 0, width, height);
}

async function extractWebGL(bitmap: ImageBitmap) {
	const canvas = document.createElement("canvas");
	const gl = canvas.getContext("webgl2")!;
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

export default defineSuite({
	params: {
		codec: decoders,
	},
	baseline: {
		type: "Name",
		value: "WASM",
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

			if (name !== "heic") {
				scene.bench("WASM", () => decode(input));
			}

			if (name in instance && name !== "jxl") {
				scene.benchAsync("Sharp", () => instance.raw().toBuffer());
			}
		} else {
			const response = await fetch(`test/snapshot/image.${extension}`);
			const blob = await response.blob();
			scene.benchAsync("WASM", async () => decode(new Uint8Array(await blob.arrayBuffer())));

			try {
				await browserDecode(blob, extract2D);
				scene.benchAsync("2d", () => browserDecode(blob, extract2D));
				scene.benchAsync("WebGL", () => browserDecode(blob, extractWebGL));
			} catch {
				// Browser does not support decode that format, skip.
			}
		}
	},
});
