import * as codecs from "../lib/index.js";

const worker = new Worker("./test/worker.js", { type: "module" });

const select = document.querySelector("select");
const encodeButton = document.getElementById("encode");
const textarea = document.querySelector("textarea");
const dlButton = document.getElementById("download");
const canvas = document.querySelector("canvas");

const ctx2D = canvas.getContext("2d");

document.getElementById("file").oninput = async event => {
	const [file] = event.currentTarget.files;
	await decode(file);
	encodeButton.removeAttribute("disabled");
};

function decode(blob) {
	if (blob.name.endsWith(".heic")) {
		return wasmDecode(blob, codecs.heic);
	}
	if (blob.name.endsWith(".wp2")) {
		return wasmDecode(blob, codecs.wp2);
	}
	if (blob.name.endsWith(".qoi")) {
		return wasmDecode(blob, codecs.qoi);
	}
	switch (blob.type) {
		case "image/JXL":
			return wasmDecode(blob, codecs.jxl);
		case "image/avif":
			return wasmDecode(blob, codecs.avif);
		case "image/jpeg":
			return wasmDecode(blob, codecs.jpeg);
		case "image/png":
			return wasmDecode(blob, codecs.png);
		case "image/webp":
			return wasmDecode(blob, codecs.webp);
	}
	window.alert("Invalid image type: " + blob.type);
}

async function wasmDecode(file, decoder) {
	const input = await file.bytes();
	await decoder.loadDecoder();
	const image = decoder.decode(input);

	canvas.width = image.width;
	canvas.height = image.height;
	ctx2D.putImageData(image, 0, 0);
}

async function builtinDecode(file) {
	const image = await createImageBitmap(file);

	canvas.width = image.width;
	canvas.height = image.height;
	ctx2D.drawImage(image, 0, 0);
}

function callWorker(args, transfer) {
	worker.postMessage(args, transfer);
	return new Promise((resolve, reject) => {
		worker.onerror = reject;
		worker.onmessage = e => resolve(e.data);
	});
}

async function encode(codec) {
	encodeButton.classList.add("busy");
	const { width, height } = canvas;
	const image = ctx2D.getImageData(0, 0, width, height);

	const options = textarea.value
		? JSON.parse(textarea.value)
		: undefined;

	const output = await callWorker([codec, image, options], [image.data.buffer]);
	encodeButton.classList.remove("busy");

	const { extension } = codecs[codec];
	download(new File([output], "output." + extension));
}

function download(file) {
	dlButton.href = URL.createObjectURL(file);
	dlButton.download = file.name;
	dlButton.click();
	URL.revokeObjectURL(dlButton.href);
}

function refreshOptions() {
	const { defaultOptions } = codecs[select.value];
	textarea.value = defaultOptions
		? JSON.stringify(defaultOptions, null, "\t") : "";
}

select.oninput = refreshOptions;
refreshOptions();
encodeButton.onclick = () => encode(select.value);
