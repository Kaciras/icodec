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
}

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
