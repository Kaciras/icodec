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
	/**
	 * representing the actual width, in pixels.
	 */
	width: number;

	/**
	 * representing the actual height, in pixels.
	 */
	height: number;

	/**
	 * Representing a one-dimensional array containing the data in the RGBA order,
	 * with integer values between 0 and 255 (inclusive).
	 * The order goes by rows from the top-left pixel to the bottom-right.
	 */
	data: Uint8Array | Uint8ClampedArray;
}

export function check<T>(value: string | null | T, hint: string) {
	if (typeof value === "string") {
		throw new Error(`${hint}: ${value}`);
	}
	if (value) return value as T; else throw new Error(hint + " failed");
}
