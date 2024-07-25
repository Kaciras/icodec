import type { EmscriptenModule } from "emscripten";
import loadEncoderWASM from "../dist/jxl-enc.js";
import loadDecoderWASM from "../dist/jxl-dec.js";

export interface JXLOptions{
	effort: number;
	quality: number;
	progressive: boolean;
	epf: number;
	lossyPalette: boolean;
	decodingSpeedTier: number;
	photonNoiseIso: number;
	lossyModular: boolean;
}

const defaults :JXLOptions= {
	effort: 7,
	quality: 75,
	progressive: false,
	epf: -1,
	lossyPalette: false,
	decodingSpeedTier: 0,
	photonNoiseIso: 0,
	lossyModular: false,
};

export const encoder = {

	wasm: null as any,

	async initialize(input: EmscriptenModule) {
		this.wasm = await loadEncoderWASM(input);
	},

	encode(data: BufferSource, width: number, height: number, options: JXLOptions) {
		options = { ...defaults, ...options };
		const result = this.wasm.encode(data, width, height, options);
		if (typeof result !== "string") {
			return result;
		}
		throw new Error(`Encode failed in ${result}`);
	},
};

export const decoder = {

	wasm: null as any,

	async initialize(input: EmscriptenModule) {
		this.wasm = await loadDecoderWASM(input);
	},

	decode(data: BufferSource) {
		const result = this.wasm.decode(data);
		if (typeof result !== "string") {
			return result;
		}
		throw new Error(`Encode failed in ${result}`);
	},
};
