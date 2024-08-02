import wasmFactory from "../dist/qoi.js";
import { check, loadES, WasmSource } from "./common.js";

export type Options = never;

export const defaultOptions = undefined as never;

export const mimeType = "image/qoi";
export const extension = "qoi";

let codecWASM: any;

export async function loadEncoder(input?: WasmSource) {
	return codecWASM = await loadES(wasmFactory, input);
}

export const loadDecoder = loadEncoder;

export function encode(data: BufferSource, width: number, height: number) {
	return check<Uint8Array>(codecWASM.encode(data, width, height, undefined), "QOI Encode");
}

export function decode(input: BufferSource) {
	return check<ImageData>(codecWASM.decode(input), "QOI Decode");
}
