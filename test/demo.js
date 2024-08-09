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
	const codec = getCodec(file);
	await decode(file, codec);
	encodeButton.removeAttribute("disabled");
};

function getCodec(blob) {
	if (blob.name.endsWith(".heic")) {
		return codecs.heic;
	}
	if (blob.name.endsWith(".wp2")) {
		return codecs.wp2;
	}
	if (blob.name.endsWith(".qoi")) {
		return codecs.qoi;
	}
	switch (blob.type) {
		case "image/JXL":
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

async function decode(file, decoder) {
	const input = await file.bytes();
	await decoder.loadDecoder();
	const image = decoder.decode(input);

	const { data, width, height } = image;
	canvas.width = width;
	canvas.height = height;
	ctx2D.putImageData(image, 0, 0);

	const shared = new SharedArrayBuffer(data.byteLength);
	const bytes = new Uint8ClampedArray(shared);
	bytes.set(data);
	sharedImageData = { data: bytes, width, height };
}

/**
 * Call encode function in the worker thread, prevents block the UI thread.
 * Multithreaded encoder is also need to run in Worker.
 *
 * @param args {unknown[]} Arguments passed to worker.
 * @param transfer {Transferable[]} An optional array of transferable objects to transfer ownership of.
 */
function invokeInWorker(args, transfer) {
	worker.postMessage(args, transfer);
	return new Promise((resolve, reject) => {
		worker.onerror = reject;
		worker.onmessage = e => resolve(e.data);
	});
}

async function encode(codec = select.value) {
	encodeButton.classList.add("busy");

	const options = textarea.value ? JSON.parse(textarea.value) : undefined;
	const output = await invokeInWorker([codec, sharedImageData, options]);
	encodeButton.classList.remove("busy");

	let { name } = fileChooser.files[0];
	const dot = name.lastIndexOf(".");
	if (dot !== -1) {
		name = name.slice(0, dot - 1);
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
