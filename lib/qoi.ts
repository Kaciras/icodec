import wasmFactory from "../dist/qoi.js";
import { check, loadES, WasmSource } from "./common.js";

export type Options = undefined;

export const defaultOptions = undefined;

export const mimeType = "image/qoi";
export const extension = "qoi";

let codecWASM: any;

export async function loadEncoder(input?: WasmSource) {
	codecWASM = await loadES(wasmFactory, input);
}

export const loadDecoder = loadEncoder;

export function decode(input: BufferSource) {
	return check<ImageData>(codecWASM.decode(input), "QOI Decode");
}

export function encode(data: BufferSource, width: number, height: number) {
	return check<Uint8Array>(codecWASM.encode(data, width, height), "QOI Encode");
}
