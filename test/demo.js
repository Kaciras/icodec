import * as codecs from "../lib/index.js";

const worker = new Worker("./test/worker.js", { type: "module" });

const fileChooser = document.getElementById("file");
const select = document.querySelector("select");
const encodeButton = document.getElementById("encode");
const textarea = document.querySelector("textarea");
const dlButton = document.getElementById("download");
const canvas = document.querySelector("canvas");

const ctx2D = canvas.getContext("2d");

let sharedImageData;

fileChooser.oninput = async event => {
	const [file] = event.currentTarget.files;
	const buffer = await file.arrayBuffer();

	const image = file.name.endsWith(".bin")
		? decodeBin(buffer)
		: await decode(buffer, getCodec(file));

	encodeButton.removeAttribute("disabled");

	const { data, width, height } = image;
	canvas.width = width;
	canvas.height = height;
	ctx2D.putImageData(image, 0, 0);

	const shared = new SharedArrayBuffer(data.byteLength);
	const bytes = new Uint8ClampedArray(shared);
	bytes.set(data);
	sharedImageData = { data: bytes, width, height };
};

function getCodec(file) {
	if (file.name.endsWith(".heic")) {
		return codecs.heic;
	}
	if (file.name.endsWith(".wp2")) {
		return codecs.wp2;
	}
	if (file.name.endsWith(".qoi")) {
		return codecs.qoi;
	}
	switch (file.type.toLowerCase()) {
		case "image/jxl":
			return codecs.jxl;
		case "image/avif":
			return codecs.avif;
		case "image/jpeg":
			return codecs.jpeg;
		case "image/png":
			return codecs.png;
		case "image/webp":
			return codecs.webp;
	}
	const message = "Unsupported image type";
	window.alert(message);
	throw new DOMException(message);
}

async function decode(buffer, decoder) {
	await decoder.loadDecoder();
	return decoder.decode(new Uint8Array(buffer));
}

function decodeBin(buffer) {
	const data = new Uint8ClampedArray(buffer, 8);
	const view = new DataView(buffer);
	const width = view.getUint32(0);
	const height = view.getUint32(4);
	return new ImageData(data, width, height);
}

/**
 * Call encode function in the worker thread, prevents block the UI thread.
 * Multithreaded encoder is also need to run in Worker.
 *
 * @param args {unknown[]} Arguments passed to worker.
 * @param transfer {Transferable[]} An optional array of transferable objects to transfer ownership of.
 */
function invokeInWorker(args, transfer) {
	return new Promise((resolve, reject) => {
		worker.onerror = reject;
		worker.onmessage = e => resolve(e.data);
		worker.postMessage(args, transfer);
	});
}

async function encode(codec = select.value) {
	encodeButton.classList.add("busy");

	const options = textarea.value ? JSON.parse(textarea.value) : undefined;
	const output = await invokeInWorker([codec, sharedImageData, options]);
	encodeButton.classList.remove("busy");

	if (output.stack) {
		console.error(output);
		return window.alert("Failed, see console for reason");
	}

	let { name } = fileChooser.files[0];
	const dot = name.lastIndexOf(".");
	if (dot !== -1) {
		name = name.slice(0, dot + 1);
	}
	download(new File([output], name + codecs[codec].extension));
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

// Set event handler, and call it immediately.
(select.oninput = refreshOptions)();

encodeButton.onclick = () => encodeButton.classList.contains("busy") || encode();
