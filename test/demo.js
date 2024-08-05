import * as codecs from "../lib/index.js";

const worker = new Worker("./test/worker.js", { type: "module" });

const select = document.querySelector("select");
const textarea = document.querySelector("textarea");
const encodeButton = document.getElementById("encode");
const dlButton = document.getElementById("download");
const canvas = document.querySelector("canvas");
const ctx2D = canvas.getContext("2d");

document.getElementById("file").oninput = event => {
	encodeButton.removeAttribute("disabled");

	const [file] = event.currentTarget.files;
	if (file.name.endsWith(".wp2")) {
		return wasmDecode(file, codecs.wp2);
	}
	if (file.name.endsWith(".qoi")) {
		return wasmDecode(file, codecs.qoi);
	}
	switch (file.type) {
		case "image/JXL":
			return wasmDecode(file, codecs.jxl);
		case "image/avif":
			return wasmDecode(file, codecs.avif);
		case "image/jpeg":
		case "image/png":
		case "image/webp":
			return builtinDecode(file);
	}
	window.alert("Invalid image type: " + file.type);
};

function callWorker(args, transfer) {
	worker.postMessage(args, transfer);
	return new Promise((resolve, reject) => {
		worker.onerror = reject;
		worker.onmessage = e => resolve(e.data);
	});
}

async function wasmDecode(file, decoder) {
	const input = await file.arrayBuffer();
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

async function encode(codec) {
	const { width, height } = canvas;
	const image = ctx2D.getImageData(0, 0, width, height);

	const options = textarea.value
		? JSON.parse(textarea.value)
		: undefined;

	const output = await callWorker([codec, image, options], [image.data.buffer]);

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
	textarea.value = defaultOptions ? JSON.stringify(defaultOptions, null, "\t") : "";
}

select.oninput = refreshOptions;
refreshOptions();

encodeButton.onclick = () => encode(select.value);
