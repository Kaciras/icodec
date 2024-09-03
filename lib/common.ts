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

export type BitDepth = 8 | 10 | 12 | 16;

export interface ImageDataLike {
	width: number;
	height: number;
	data: Uint8Array | Uint8ClampedArray;
	depth: BitDepth;

	to8BitDepth(): ImageDataLike;
}

/**
 * Node does not have `ImageData` class, so we define a pure version.
 */
export class PureImageData implements ImageDataLike {

	readonly data: Uint8ClampedArray;
	readonly width: number;
	readonly height: number;
	readonly depth: BitDepth;

	constructor(data: Uint8ClampedArray, width: number, height: number, depth: BitDepth = 8) {
		this.data = data;
		this.width = width;
		this.height = height;
		this.depth = depth;
	}

	to8BitDepth() {
		const { data, width, height, depth } = this;
		if (depth === 8) {
			return this;
		}
		const bytes = new Uint8ClampedArray(data.length / 2);
		const max = (1 << depth) - 1;
		// const view = new Uint16Array(data.buffer, data.byteOffset);
		for (let i = 0; i < bytes.length; i++) {
			bytes[i] = data[i * 2 +1];
		}
		return new this.constructor(bytes, width, height, 8);
	}
}

// @ts-expect-error
PureImageData.prototype.colorSpace = "srgb";

export function encodeES<T>(name: string, wasm: any, defaults: T, image: ImageDataLike, options?: T) {
	options = { ...defaults, ...options };
	const { data, width, height } = image;
	const result = wasm.encode(data, width, height, options);
	return check<Uint8Array>(result, name);
}

export function check<T>(value: string | null | T, hint: string) {
	if (typeof value === "string") {
		throw new Error(`${hint}: ${value}`);
	}
	if (value) return value as T; else throw new Error(hint + " failed");
}
