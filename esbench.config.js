import { defineConfig, inProcessExecutor, WebRemoteExecutor } from "esbench/host";

export default defineConfig({
	toolchains: [{
		executors: [
			inProcessExecutor,
			new WebRemoteExecutor({ assets: { "/test": "test" } }),
		],
	}],
});
