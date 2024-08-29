import { defineConfig, inProcessExecutor, WebRemoteExecutor } from "esbench/host";

const web = new WebRemoteExecutor({ assets: { "/test": "test" } });

export default defineConfig({
	toolchains: [{
		include: ["./benchmark/encode.ts"],
		executors: [inProcessExecutor],
	},{
		include: ["./benchmark/decode.ts"],
		executors: [inProcessExecutor, web],
	}],
});
