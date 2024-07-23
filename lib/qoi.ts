import { readFileSync } from "fs";
import loadWASM from "../dist/qoi.js";

let wasmModule: any;

class PureImageData {
	readonly data: Uint8ClampedArray;
	readonly width: number;
	readonly height: number;

	constructor(data: Uint8ClampedArray, width: number, height: number) {
		this.data = data;
		this.width = width;
		this.height = height;
	}
}

export async function initialize() {
	const wasmBinary = readFileSync("dist/qoi.wasm");
	wasmModule = await loadWASM({ wasmBinary	});
}

export function encode(data: BufferSource, width: number, height: number) {
	const result = wasmModule.encode(data, width, height, {});
	if (result) {
		return result;
	}
	throw new Error("Encode failed");
}

export function decode(data: BufferSource) {
	return wasmModule.decode(data) as ImageData;
}
