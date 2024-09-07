/**
 * Parameter type of `loadEncoder()` and `loadDecoder()`.
 *
 * - If is a string, it's the URL of WASM file to fetch.
 * - If is BufferSource, it will be treated as the WASM bytes.
 */
export type WasmSource = string | BufferSource;

export function loadES(factory: any, source?: WasmSource) {
	return typeof source === "string"
		? factory({ locateFile: () => source })
		: factory({ wasmBinary: source });
}

export interface ImageDataLike {
	width: number;
	height: number;
	data: Uint8Array | Uint8ClampedArray;
	depth: number;
}

export function toBitDepth(image: ImageDataLike, value: number) {
	const { data, width, height, depth = 8 } = image;
	if (value === depth) {
		return image;
	}
	const pixels = width * height * 4;
	const newData = value === 8
		? new Uint8ClampedArray(pixels)
		: new Uint16Array(pixels);
	const view = depth === 8
		? data
		: new Uint16Array(data.buffer, data.byteOffset);

	const from = (1 << depth) - 1;
	const to = (1 << value) - 1;
	for (let i = 0; i < pixels; i++) {
		newData[i] = view[i] / from * to + 0.5;
	}

	const nd = new Uint8ClampedArray(newData.buffer, newData.byteOffset, newData.byteLength);
	return _icodec_ImageData(nd, width, height, value);
}

/**
 * Node does not have `ImageData` class, so we define a pure version.
 */
export class PureImageData implements ImageDataLike {

	readonly data: Uint8ClampedArray;
	readonly width: number;
	readonly height: number;
	readonly depth: number;

	constructor(data: Uint8ClampedArray, width: number, height: number, depth = 8) {
		this.data = data;
		this.width = width;
		this.height = height;
		this.depth = depth;
	}
}

// @ts-expect-error
PureImageData.prototype.colorSpace = "srgb";

export function encodeES<T>(name: string, wasm: any, defaults: T, image: ImageDataLike, options?: T) {
	options = { ...defaults, ...options };
	const { data, width, height } = image;
	(options as any).bitDepth = image.depth;
	const result = wasm.encode(data, width, height, options);
	return check<Uint8Array>(result, name);
}

export function check<T>(value: string | null | T, hint: string) {
	if (typeof value === "string") {
		throw new Error(`${hint}: ${value}`);
	}
	if (value) return value as T; else throw new Error(hint + " failed");
}
