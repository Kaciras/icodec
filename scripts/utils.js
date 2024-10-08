import { basename, extname, join } from "node:path";
import { execFile, execFileSync } from "node:child_process";
import { promisify } from "node:util";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import * as TOML from "smol-toml";
import versionCompare from "version-compare";

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
	wasm64: false,

	/**
	 * Specify -G parameter of cmake, e.g. "Ninja"
	 */
	cmakeBuilder: null,

	/**
	 * The maximum number of concurrent processes to use when building.
	 */
	parallel: navigator.hardwareConcurrency,
};

function gitClone(dir, branch, url) {
	const cwd = "vendor/" + dir;
	if (existsSync(cwd)) {
		return;
	}
	if (branch.length === 40) {
		execFileSync("git", ["-c", "advice.detachedHead=false", "clone", "--depth", "1", url, cwd]);
		execFileSync("git", ["fetch", "--depth", "1", "origin", branch], { cwd });
		execFileSync("git", ["reset", "--hard", branch], { cwd });
	} else {
		execFileSync("git", ["-c", "advice.detachedHead=false", "clone", "--depth", "1", "--branch", branch, url, cwd]);
	}
	execFileSync("git", ["submodule", "update", "--init", "--depth", "1", "--recursive"], { cwd });
}

export function patchFile(path, doPatch) {
	const backup = path + ".path_backup";
	if (existsSync(backup)) {
		return;
	}
	const content = doPatch(path);
	renameSync(path, backup);
	writeFileSync(path, content);
}

export function removeRange(file, start, end) {
	patchFile(file, file => {
		const content = readFileSync(file, "utf8");
		const i = content.indexOf(start);
		const j = content.indexOf(end, i);
		return content.slice(0, i) + content.slice(j);
	});
}

const semverRE = /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)(\.(0|[1-9]\d*))?(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;

/*
 * `compare-versions` does not support "v3.0-pre"
 * `version-compare` does not strip leading "v"
 */
function resolveVersion(tag) {
	const matches = semverRE.exec(tag);
	if (!matches) {
		return null;
	}
	const v = matches[0];
	return v.charCodeAt(0) === 118 ? v.slice(1) : v;
}

async function checkUpdateGit(key, branch, repo) {
	const cwd = "vendor/" + key;
	const version = resolveVersion(branch);

	if (version) {
		// Returns in strings order, which is equivalent to unordered.
		const stdout = execFileSync("git", ["ls-remote", "--tags", "origin"], { cwd, encoding: "utf8" });

		let latest = version;
		for (const line of stdout.split("\n")) {
			// 40 hash + \t + refs/tags/ = 51 chars
			const remote = resolveVersion(line.slice(51));
			if (!remote) {
				continue;
			}
			if (versionCompare(remote, latest) === 1) {
				latest = remote;
			}
		}
		if (latest !== version) {
			console.log(`${repo} ${branch} -> ${latest}`);
		}
	} else {
		execFileSync("git", ["fetch", "--quiet"], { cwd });
		const stdout = execFileSync("git", ["log", "HEAD..origin", "--pretty=%at"], {
			cwd,
			encoding: "utf8",
		});
		const commits = stdout.split("\n").filter(Boolean);
		if (commits.length === 0) {
			return;
		}
		const date = new Date(parseInt(commits[0]) * 1000).toISOString();
		console.log(`${repo} has new commits, latest date: ${date}`);
	}
}

async function checkUpdateCargo(cwd) {
	// execFileSync does not return stderr, which is cargo will output.
	const execFileAsync = promisify(execFile);
	const { stderr } = await execFileAsync("cargo", ["update", "--dry-run"], {
		cwd,
		encoding: "utf8",
	});

	const cargo = TOML.parse(readFileSync(`${cwd}/cargo.toml`, "utf8"));
	const re = /Updating (\S+) v([0-9.]+) -> v([0-9.]+)/g;

	let primaryUpdatable = false;
	let deepDeps = 0;
	for (const [, name, old, latest] of stderr.matchAll(re)) {
		if (Object.hasOwn(cargo.dependencies, name)) {
			primaryUpdatable = true;
			console.info(`${name} ${old} -> ${latest}`);
		} else {
			deepDeps += 1;
		}
	}
	if (primaryUpdatable) {
		console.info(`Others ${deepDeps} carets update available.`);
	}
}

export class RepositoryManager {

	constructor(repos) {
		this.repos = Object.entries(repos);
		mkdirSync(config.outDir, { recursive: true });
	}

	download() {
		for (const [k, v] of this.repos) {
			gitClone(k, v[0], v[1]);
		}
	}

	async checkUpdate() {
		console.log(`Checking ${this.repos.length} repos + cargo...\n`);
		await checkUpdateCargo("rust");
		for (const [key, value] of this.repos) {
			await checkUpdateGit(key, ...value);
		}
	}

	writeVersionsJSON() {
		const json = [];
		for (const [name, [version, repository]] of this.repos) {
			const entry = { name, version, repository };
			json.push(entry);

			if (semverRE.test(version)) {
				continue;
			}
			const stdout = execFileSync("git", ["log", "-1", "--format=%h %at"], {
				cwd: `vendor/${name}`,
				encoding: "utf8",
			});
			const [hash, timestamp] = stdout.split(" ");
			const date = new Date(parseInt(timestamp) * 1000);
			entry.version = `${hash} ${date.toISOString().split("T")[0]}`;
		}
		writeFileSync("versions.json", JSON.stringify(json));
	}
}

export function setHardwareConcurrency(name, value) {
	const old = readFileSync(name, "utf8");
	const new_ = old.replace('navigator["hardwareConcurrency"]', value);
	writeFileSync(name, new_);
	if (old === new_) {
		throw new Error(name + ": Cannot find the pattern to replace");
	}
}

export function emcmake(settings) {
	const { outFile, src, dist = src, flags, options = {} } = settings;
	if (!config.rebuild && existsSync(outFile)) {
		return;
	}

	let cxxFlags = "-mnontrapping-fptoint -pthread -msimd128";
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
