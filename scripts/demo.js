import { pathPrefix, pathSuffix, RPC, saveFile } from "../node_modules/@kaciras/utilities/lib/browser.js";
import * as codecs from "../lib/index.js";
import { toBitDepth } from "../lib/common.js";

const worker = new Worker("/scripts/worker.js", { type: "module" });
const workerRPC = RPC.probeClient(worker);

const fileChooser = document.getElementById("file");
const select = document.querySelector("select");
const encodeButton = document.getElementById("encode");
const textarea = document.querySelector("textarea");
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
	ctx2d.putImageData(toBitDepth(image, 8), 0, 0);

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
	const mime = file.type.toLowerCase();
	const ext = pathSuffix(file.name, ".");

	const codec = Object.values(codecs).find(member =>
		mime === member.mimeType ||
		ext === member.extension,
	);
	if (codec) {
		return codec;
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

async function encode(codec = select.value) {
	encodeButton.classList.add("busy");
	const options = textarea.value ? JSON.parse(textarea.value) : undefined;
	sessionStorage.setItem(`icodec:options.${codec}`, textarea.value);

	const start = performance.now();
	const output = await workerRPC.encode(codec, sharedImageData, options);
	const time = (performance.now() - start) / 1000;

	document.querySelector("time").textContent = `${time.toFixed(2)}s`;
	encodeButton.classList.remove("busy");

	const baseName = pathPrefix(fileChooser.files[0].name, ".");
	const ext = codecs[codec].extension;
	saveFile(new File([output], `${baseName}.${ext}`));
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
