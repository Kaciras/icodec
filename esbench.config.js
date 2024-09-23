import { defineConfig, inProcessExecutor, WebRemoteExecutor } from "esbench/host";

const webExecutor = new WebRemoteExecutor({
	open: {},
	assets: { "/test": "test" },
});

export default defineConfig({
	toolchains: [{
		include: ["./benchmark/encode.ts"],
		executors: [inProcessExecutor],
	},{
		include: ["./benchmark/decode.ts"],
		executors: [inProcessExecutor, webExecutor],
	}],
});
