import * as codecs from "../lib/index.js";
import { toBitDepth } from "../lib/common.js";

const worker = new Worker("/scripts/worker.js", { type: "module" });

const fileChooser = document.getElementById("file");
const select = document.querySelector("select");
const encodeButton = document.getElementById("encode");
const textarea = document.querySelector("textarea");
const dlButton = document.getElementById("download");
const canvas = document.querySelector("canvas");

const ctx2d = canvas.getContext("2d");

let sharedImageData;

fileChooser.oninput = async event => setFile(event.currentTarget.files[0]);

async function setFile(file) {
	const image = await parseFile(file);

	document.getElementById("info").textContent =
		`Type: ${file.type}, ${image.width} x ${image.height}, ${image.depth}-bit`;

	encodeButton.removeAttribute("disabled");

	const { data, width, height, depth } = image;
	canvas.width = width;
	canvas.height = height;
	ctx2d.putImageData(toBitDepth(image,8), 0, 0);

	/*
	 * Avoid copying of buffer for multiple conversions.
	 *
	 * Another way is to have the worker pass back the image,
	 * but this is more complex.
	 */
	const shared = new SharedArrayBuffer(data.byteLength);
	const bytes = new Uint8ClampedArray(shared);
	bytes.set(data);
	sharedImageData = { data: bytes, width, height, depth };
}

async function parseFile(file) {
	const buffer = await file.arrayBuffer();

	if (file.name.endsWith(".bin")) {
		Object.defineProperty(file, "type", { value: "-----/----" });
		return decodeBin(buffer);
	} else {
		const codec = getCodec(file);
		Object.defineProperty(file, "type", { value: codec.mimeType });
		return decode(buffer, codec);
	}
}

function getCodec(file) {
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
	if (file.name.endsWith(".heic")) {
		return codecs.heic;
	}
	if (file.name.endsWith(".wp2")) {
		return codecs.wp2;
	}
	if (file.name.endsWith(".qoi")) {
		return codecs.qoi;
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
	const [width, height, depth] = new Uint32Array(buffer);
	const data = new Uint8ClampedArray(buffer, 12);
	return _icodec_ImageData(data, width, height, depth);
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
	sessionStorage.setItem(`icodec:options.${codec}`, textarea.value);

	const start = performance.now();
	const output = await invokeInWorker([codec, sharedImageData, options]);
	const time = (performance.now() - start) / 1000;

	document.querySelector("time").textContent = `${time.toFixed(2)}s`;
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
	const saved = sessionStorage.getItem(`icodec:options.${select.value}`);
	textarea.value = saved ?? defaultOptions
		? JSON.stringify(defaultOptions, null, "\t") : "";
}

document.ondrop = event => {
	if (event.target === textarea) {
		return; // Allow drop text into options editor.
	}
	event.preventDefault();
	const [file, ...rest] = event.dataTransfer.items;
	if (rest.length !== 0) {
		return window.alert("Cannot drop multiple items");
	}
	if (file.kind === "file") {
		return setFile(file.getAsFile());
	}
};

/*
 * To change that behavior so that an element becomes a drop zone or is droppable,
 * the element must listen to both dragover and drop events.
 */
document.ondragover = event => event.preventDefault();

// Set event handler, and call it immediately.
(select.oninput = refreshOptions)();

encodeButton.onclick = () => encodeButton.classList.contains("busy") || encode();

if (!window.SharedArrayBuffer) {
	window.alert("SharedArrayBuffer is not available, " +
		"you may need to serve the page with scripts/start-demo.js");
}
