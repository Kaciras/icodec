import { basename, extname, join } from "node:path";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

export const config = {
	/**
	 * Directory name that WASM and JS interop files placed to.
	 */
	outDir: "dist",

	/**
	 * Force rebuild 3rd-party libraries.
	 */
	rebuild: false,

	/**
	 * Set to true to build in debug mode, default is release mode.
	 */
	debug: false,

	/**
	 * Build in 64-bit WASM, allows to access more than 4GB RAM.
	 * This is an experimental feature.
	 * https://github.com/WebAssembly/memory64/blob/main/proposals/memory64/Overview.md
	 *
	 * You'll also need to rebuild if you previously built 32-bit version.
	 */
	wasm64: true,

	/**
	 * Specify -G parameter of cmake, e.g. "Ninja"
	 */
	cmakeBuilder: null,

	/**
	 * The maximum number of concurrent processes to use when building.
	 */
	parallel: navigator.hardwareConcurrency,

	updateFromArgs(args) {
		for (const arg of args) {
			const match = /--([^=]+)(?:=(.+))?/.exec(arg);
			if (!match) {
				console.error("Invalid argument: " + arg);
				process.exit(1);
			}
			const [, key, value] = match;
			switch (typeof this[key]) {
				case "boolean":
					this[key] = true;
					break;
				case "number":
					this[key] = parseInt(value);
					break;
				default:
					this[key] = value;
			}
		}
	},
};

export function fixPThreadImpl(name, concurrency) {
	const original = readFileSync(name, "utf8");
	let code = original.replace('navigator["hardwareConcurrency"]', concurrency);

	// https://github.com/emscripten-core/emscripten/issues/22394
	const match = code.match(/var\s+workerOptions\s*=\s*({[^}]+});/);
	const before = code.slice(0, match.index);
	const after = code.slice(match.index + match[0].length);
	const usage = /workerOptions(?![\\w$])/;
	usage.lastIndex = match.index + match[0].length;
	code = before + after.replace(usage, match[1]);

	writeFileSync(name, code);
	if (original === code) {
		throw new Error(name + ": Cannot find the pattern to replace");
	}
}

export function emcmake(settings) {
	const { outFile, src, dist = src, flags, options = {} } = settings;
	if (!config.rebuild && existsSync(outFile)) {
		return;
	}

	let cxxFlags = "-pthread -msimd128";
	if (config.wasm64) {
		cxxFlags += " -sMEMORY64";
	}
	if (!settings.exceptions) {
		cxxFlags += " -fno-exceptions";
	}

	if (flags) {
		cxxFlags += " ";
		cxxFlags += flags;
	}

	const args = [
		"cmake", "-S", src, "-B", dist,
		"--fresh",
		"-Wno-dev",
		`-DCMAKE_C_FLAGS="${cxxFlags}"`,
		`-DCMAKE_CXX_FLAGS="${cxxFlags} -std=c++23"`,
		"-DCMAKE_WARN_DEPRECATED=OFF",
	];
	if (config.cmakeBuilder) {
		args.push("-G", `"${config.cmakeBuilder}"`);
	}
	if (config.debug) {
		args.push("-DCMAKE_BUILD_TYPE=Debug");
	} else {
		args.push("-DCMAKE_BUILD_TYPE=Release");
	}
	for (const [k, v] of Object.entries(options)) {
		args.push(`-D${k}=${v}`);
	}
	execFileSync("emcmake", args, { stdio: "inherit", shell: true });

	const buildArgs = ["--build", ".", "-j", config.parallel];
	execFileSync("cmake", buildArgs, { cwd: dist, stdio: "inherit" });
}

export function emcc(input, sourceArguments) {
	let output = basename(input, extname(input)).replaceAll("_", "-") + ".js";
	output = join(config.outDir, output);

	const args = [
		config.debug ? "-g" : "-O3",
		"-o", output,
		"-I", "cpp",
		input,
		"--bind",
		"-mnontrapping-fptoint",
		"-msimd128",
		"-flto",
		"-std=c++23",
		"-s", "NODEJS_CATCH_REJECTION=0",
		"-s", "TEXTDECODER=2",
		"-s", "ALLOW_MEMORY_GROWTH=1",
		"-s", "EXPORT_ES6=1",

		/*
		 * Default 64KB is too small, causes OOM in some cases.
		 * libwebp sets it to 5MB, but 2MB seems to be enough.
		 */
		"-s", "STACK_SIZE=2MB",

		// Save ~69KB, but may affect performance.
		// "-s", "MALLOC=emmalloc",

		// Save ~10KB, but it needs some work on our part.
		// "-s", "MINIMAL_RUNTIME=1",
	];
	if (config.wasm64) {
		args.push("-s", "MEMORY64=1");
	}
	if (config.debug) {
		args.push("-s", "NO_DISABLE_EXCEPTION_CATCHING");
		args.push("-s", "ASSERTIONS=2");
	} else {
		args.push("-fno-exceptions");
		args.push("-s", "FILESYSTEM=0");
		args.push("-s", "ENVIRONMENT=web");
	}

	args.push(...sourceArguments);

	/*
	 * Debug build add an assert for environment check, so we need to
	 * add Node to the list, or remove the check code from generated JS.
	 */
	if (config.debug) {
		args.push("-s", "ENVIRONMENT=node,web,worker");
	}

	execFileSync("emcc", args, { stdio: "inherit", shell: true });
	console.info(`Successfully build WASM module: ${output}`);
}

export function wasmPack(directory) {
	const flags = [
		"-Ctarget-feature=+simd128,+atomics,+bulk-memory,+nontrapping-fptoint",
		"-Cembed-bitcode=yes",
		"-Cllvm-args=-wasm-enable-sjlj",
		"-Cllvm-args=-enable-emscripten-cxx-exceptions=0",
	];

	const env = {
		RUSTFLAGS: flags.join(" "),
		...process.env,
	};
	if (env.EMSDK) {
		env.CC = join(env.EMSDK, "upstream/bin/clang");
	}

	// https://github.com/rustwasm/wasm-pack/blob/62ab39cf82ec4d358c1f08f348cd0dc44768f412/src/command/build.rs#L116
	const args = [
		"build", directory,
		"--no-typescript",
		"--no-pack",
		"--reference-types",
		"--weak-refs",
		"--target", "web",
	];
	if (config.debug) {
		args.push("--dev");
	}
	execFileSync("wasm-pack", args, { stdio: "inherit", env });
}
