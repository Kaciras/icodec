import { jxl, qoi, wp2 } from "../lib/index.js";

const canvas = document.querySelector("canvas");

document.getElementById("file").oninput = e => {
	const [file] = e.currentTarget.files;
	if (file.name.endsWith(".wp2")) {
		return wasmDecode(file, wp2);
	}
	if (file.name.endsWith(".qoi")) {
		return wasmDecode(file, qoi);
	}
	switch (file.type) {
		case "image/JXL":
			return wasmDecode(file, jxl);
		case "image/jpeg":
		case "image/png":
		case "image/webp":
		case "image/avif":
			return builtinDecode(file);
	}
	window.alert("Invalid image type: " + file.type);
};

globalThis._ICodec_ImageData = ImageData;

async function wasmDecode(file, decoder) {
	const input = await file.arrayBuffer();

	await decoder.loadDecoder();
	const image = decoder.decode(input);

	canvas.width = image.width;
	canvas.height = image.height;
	canvas.getContext("2d").putImageData(image, 0, 0);
}

async function builtinDecode(file) {
	const image = await createImageBitmap(file);

	const { width, height } = image;
	canvas.width = width;
	canvas.height = height;

	const ctx = canvas.getContext("2d");
	ctx.drawImage(image, 0, 0);
	return ctx.getImageData(0, 0, width, height);
}
