declare module "*-enc.js" {
	import { EmscriptenModule, EmscriptenModuleFactory } from "emscripten";

	export interface Module extends EmscriptenModule {
		encode(data: BufferSource, width: number, height: number, options: object): Uint8Array | null;
	}

	export default 0 as unknown as EmscriptenModuleFactory<Module>;
}

declare module "*-dec.js" {
	import { EmscriptenModule, EmscriptenModuleFactory } from "emscripten";

	export interface Module extends EmscriptenModule {
		decode(data: BufferSource): ImageData | null;
	}

	export default 0 as unknown as EmscriptenModuleFactory<Module>;
}
