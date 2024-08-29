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

mkdirSync(config.outDir, { recursive: true });

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
		const j = content.indexOf(end);
		return content.slice(0, i) + content.slice(j);
	});
}

const semVerRe = /v?[0-9.]+$/;

async function checkUpdateGit(key, branch, repo) {
	const cwd = "vendor/" + key;
	const tag = semVerRe.exec(branch);

	if (tag) {
		const stdout = execFileSync("git", ["ls-remote", "--tags", "origin"], { cwd, encoding: "utf8" });
		const current = tag[0];
		let latest = current;
		for (const line of stdout.split("\n")) {
			const matches = semVerRe.exec(line);
			if (!matches || line.at(-matches[0].length) !== "/") {
				continue;
			}
			if (matches[1] === current) {
				break;
			}
			if (versionCompare(matches[1], latest) === 1) {
				latest = matches[1];
			}
		}
		if (latest !== current) {
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
}

export function setHardwareConcurrency(name, value) {
	const old = readFileSync(name, "utf8");
	const new_ = old.replace('navigator["hardwareConcurrency"]', value);
	writeFileSync(name, new_);
	if (old === new_) {
		throw new Error(name + ": Cannot find the pattern to replace");
	}
}

export function cmake(settings) {
	const { outFile, src, dist = src, options = {} } = settings;
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
		"-o", output,
		"-I", "cpp",
		input,
		config.debug ? "-g" : "-O3",
		"--bind",
		"-msimd128",
		"-flto",
		"-std=c++23",
		"-s", "NODEJS_CATCH_EXIT=0",
		"-s", "NODEJS_CATCH_REJECTION=0",
		"-s", "TEXTDECODER=2",
		"-s", "ENVIRONMENT=web",
		"-s", "ALLOW_MEMORY_GROWTH=1",
		"-s", "EXPORT_ES6=1",
	];
	if (config.debug) {
		args.push("-s", "NO_DISABLE_EXCEPTION_CATCHING");
	} else {
		args.push("-fno-exceptions");
		args.push("-s", "FILESYSTEM=0");
	}
	if (config.wasm64) {
		args.push("-s", "MEMORY64=1");
	}
	args.push(...sourceArguments);
	execFileSync("emcc", args, { stdio: "inherit", shell: true });
	console.info(`Successfully build WASM module: ${output}`);
}

export function wasmPack(directory) {
	const env = { ...process.env };
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
