export type WasmSource = string | BufferSource;

export function loadES(factory: any, input?: WasmSource) {
	return typeof input === "string"
		? factory({ locateFile: () => input })
		: factory({ wasmBinary: input });
}

export function check<T>(value: string | null | T, hint: string) {
	if (typeof value === "string") {
		throw new Error(`${hint}: ${value}`);
	}
	if (value) return value as T; else throw new Error(hint + " failed");
}
