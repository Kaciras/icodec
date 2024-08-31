import wasmFactory from "../dist/qoi.js";
import { check, ImageDataLike, loadES, WasmSource } from "./common.js";

/**
 * QOI encoder does not have options, it's always lossless.
 */
export type Options = never;

export const defaultOptions = undefined as never;

export const mimeType = "image/qoi";
export const extension = "qoi";

let codecWASM: any;

export async function loadEncoder(input?: WasmSource) {
	return codecWASM = await loadES(wasmFactory, input);
}

export const loadDecoder = loadEncoder;

export function encode(image: ImageDataLike) {
	const { data, width, height } = image;
	const result = codecWASM.encode(data, width, height, undefined);
	return check<Uint8Array>(result, "QOI Encode");
}

export function decode(input: BufferSource) {
	return check<ImageData>(codecWASM.decode(input), "QOI Decode");
}
