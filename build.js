import { execFile, execFileSync } from "child_process";
import { join } from "path";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "fs";
import { promisify } from "util";
import versionCompare from "version-compare";

export const config = {
	/**
	 * Directory name that WASM and JS interop files placed to.
	 */
	outDir: "dist",

	/**
	 * Force rebuild 3rd-party libraries, it will take more time.
	 */
	rebuild: false,

	/**
	 * Set to true to build in debug more, default is release.
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

const repositories = {
	mozjpeg: ["v4.1.5", "https://github.com/mozilla/mozjpeg"],
	qoi: ["master", "https://github.com/phoboslab/qoi"],
	libwebp: ["v1.4.0", "https://github.com/webmproject/libwebp"],
	libjxl: ["v0.8.3", "https://github.com/libjxl/libjxl"],
	libavif: ["v1.1.1", "https://github.com/AOMediaCodec/libavif"],
	"libavif/ext/aom": ["v3.9.1", "https://aomedia.googlesource.com/aom"],
	libwebp2: ["main", "https://chromium.googlesource.com/codecs/libwebp2",],
	x265: ["3.6", "https://bitbucket.org/multicoreware/x265_git"],
	libde265: ["v1.0.15", "https://github.com/strukturag/libde265"],
	libheif: ["v1.18.1", "https://github.com/strukturag/libheif"],
	vvenc: ["v1.12.0", "https://github.com/fraunhoferhhi/vvenc"],
};

mkdirSync(config.outDir, { recursive: true });

function gitClone(directory) {
	const [branch, url] = repositories[directory];
	const cwd = "vendor/" + directory;
	if (existsSync(cwd)) {
		return true;
	}
	execFileSync("git", ["-c", "advice.detachedHead=false", "clone", "--depth", "1", "--branch", branch, url, cwd]);
	execFileSync("git", ["submodule", "update", "--init", "--depth", "1", "--recursive"], { cwd });
}

function cmake(settings) {
	const { outFile, src, dist = src, options } = settings;
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

function emcc(output, sourceArguments) {
	output = join(config.outDir, output);
	const args = [
		config.debug ? "-g" : "-O3",
		"--bind",
		"-msimd128",
		"-fno-exceptions",
		"-flto",
		"-s", "NODEJS_CATCH_EXIT=0",
		"-s", "NODEJS_CATCH_REJECTION=0",
		"-s", "TEXTDECODER=2",
		"-s", "ENVIRONMENT=web",
		"-s", "ALLOW_MEMORY_GROWTH=1",
		"-s", "EXPORT_ES6=1",
		"-I", "cpp",
		"-o", output,
		...sourceArguments,
	];
	if (!sourceArguments.some(arg => arg.endsWith(".c"))) {
		args.push("-std=c++23");
	}
	if (config.debug) {
		args.push("-s", "NO_DISABLE_EXCEPTION_CATCHING");
	} else {
		args.push("-s", "FILESYSTEM=0");
	}
	if (config.wasm64) {
		args.push("-s", "MEMORY64=1");
	}
	execFileSync("emcc", args, { stdio: "inherit", shell: true });
	console.info(`Successfully build WASM module: ${output}`);
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
		execFileSync("git", ["fetch"], { cwd });
		const stdout = execFileSync("git", ["log", `HEAD..origin/${branch}`, "--pretty=%at"], {
			cwd,
			encoding: "utf8",
		});
		const commits = stdout.split("\n").filter(Boolean);
		if (commits.length === 0) {
			return;
		}
		const date = new Date(parseInt(commits[0]) * 1000).toISOString();
		console.log(`${repo} ${commits.length} new commits, ${date}`);
	}
}

async function checkUpdateCargo() {
	// execFileSync does not return stderr, which is cargo will output.
	const execFileAsync = promisify(execFile);
	const { stderr } = await execFileAsync("cargo", ["update", "--dry-run"], {
		cwd: "rust",
		encoding: "utf8",
	});

	const primary = ["oxipng", "imagequant", "png", "lol_alloc"];
	const re = /Updating (\S+) v([0-9.]+) -> v([0-9.]+)/g;
	let primaryUpdatable = false;
	let deepDeps = 0;
	for (const [, name, old, latest] of stderr.matchAll(re)) {
		if (primary.includes(name)) {
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

async function checkForUpdates() {
	const repoEntries = Object.entries(repositories);
	console.log(`Checking ${repoEntries.length} repos + cargo...\n`);

	await checkUpdateCargo();
	for (const [key, value] of repoEntries) {
		await checkUpdateGit(key, ...value);
	}
}

// ============================== Build Scripts ==============================

export function buildMozJPEG() {
	gitClone("mozjpeg");

	cmake({
		outFile: "vendor/mozjpeg/libjpeg.a",
		src: "vendor/mozjpeg",
		options: {
			WITH_SIMD: "0",
			ENABLE_SHARED: "0",
			WITH_TURBOJPEG: "0",
			PNG_SUPPORTED: "0",
		},
	});
	emcc("mozjpeg.js", [
		"-I vendor/mozjpeg",
		"cpp/mozjpeg.cpp",
		"vendor/mozjpeg/libjpeg.a",
		"vendor/mozjpeg/rdswitch.c",
	]);
}

export function buildPNGQuant() {
	const env = { ...process.env };
	if (env.EMSDK) {
		env.CC = join(env.EMSDK, "upstream/bin/clang");
	}

	// https://github.com/rustwasm/wasm-pack/blob/62ab39cf82ec4d358c1f08f348cd0dc44768f412/src/command/build.rs#L116
	const args = [
		"build", "rust",
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

	// `--out-dir` cannot be out of the rust workspace.
	renameSync("rust/pkg/pngquant.js", `${config.outDir}/pngquant.js`);
	renameSync("rust/pkg/pngquant_bg.wasm", `${config.outDir}/pngquant_bg.wasm`);
}

export function buildQOI() {
	gitClone("qoi");
	emcc("qoi.js", ["-I vendor/qoi", "cpp/qoi.cpp"]);
}

export function buildWebP() {
	gitClone("libwebp");
	cmake({
		outFile: "vendor/libwebp/libwebp.a",
		src: "vendor/libwebp",
		options: {
			WEBP_ENABLE_SIMD: "1",

			WEBP_BUILD_CWEBP: "0",
			WEBP_BUILD_DWEBP: "0",
			WEBP_BUILD_GIF2WEBP: "0",
			WEBP_BUILD_IMG2WEBP: "0",
			WEBP_BUILD_VWEBP: "0",
			WEBP_BUILD_WEBPINFO: "0",
			WEBP_BUILD_LIBWEBPMUX: "0",
			WEBP_BUILD_WEBPMUX: "0",
			WEBP_BUILD_EXTRAS: "0",
			WEBP_USE_THREAD: "0",
			WEBP_BUILD_ANIM_UTILS: "0",
		},
	});

	emcc("webp-enc.js", [
		"-I vendor/libwebp",
		"cpp/webp_enc.cpp",
		"vendor/libwebp/libwebp.a",
		"vendor/libwebp/libsharpyuv.a",
	]);
	emcc("webp-dec.js", [
		"-I vendor/libwebp",
		"cpp/webp_dec.cpp",
		"vendor/libwebp/libwebp.a",
		"vendor/libwebp/libsharpyuv.a",
	]);
}

export function buildJXL() {
	gitClone("libjxl");
	// highway uses CJS scripts in build, our project is ESM.
	writeFileSync("vendor/libjxl/third_party/highway/package.json", "{}");

	cmake({
		outFile: "vendor/libjxl/lib/libjxl.a",
		src: "vendor/libjxl",
		options: {
			BUILD_SHARED_LIBS: "0",
			BUILD_TESTING: "0",
			JPEGXL_ENABLE_SJPEG: "0",
			JPEGXL_ENABLE_JNI: "0",
			JPEGXL_ENABLE_BENCHMARK: "0",
			JPEGXL_ENABLE_DOXYGEN: "0",
			JPEGXL_ENABLE_EXAMPLES: "0",
		},
	});

	const libs = [
		"-I vendor/libjxl/third_party/highway",
		"-I vendor/libjxl/third_party/skcms",
		"-I vendor/libjxl",
		"-I vendor/libjxl/lib/include",
		"vendor/libjxl/lib/libjxl.a",
		"vendor/libjxl/third_party/brotli/libbrotlidec-static.a",
		"vendor/libjxl/third_party/brotli/libbrotlienc-static.a",
		"vendor/libjxl/third_party/brotli/libbrotlicommon-static.a",
		"vendor/libjxl/third_party/highway/libhwy.a",
	];
	emcc("jxl-enc.js", [...libs, "cpp/jxl_enc.cpp"]);
	emcc("jxl-dec.js", [...libs, "cpp/jxl_dec.cpp"]);
}

// Must build WebP before to generate libsharpyuv.a
export function buildAVIF() {
	gitClone("libavif");
	gitClone("libavif/ext/aom");

	mkdirSync("vendor/libavif/ext/aom/build.libavif", { recursive: true });

	cmake({
		outFile: "vendor/libavif/ext/aom/build.libavif/libaom.a",
		src: "vendor/libavif/ext/aom",
		dist: "vendor/libavif/ext/aom/build.libavif",
		options: {
			ENABLE_CCACHE: "0",
			AOM_TARGET_CPU: "generic",
			AOM_EXTRA_C_FLAGS: "-UNDEBUG",
			AOM_EXTRA_CXX_FLAGS: "-UNDEBUG",
			ENABLE_DOCS: "0",
			ENABLE_TESTS: "0",
			ENABLE_EXAMPLES: "0",
			ENABLE_TOOLS: "0",
			CONFIG_ACCOUNTING: "1",
			CONFIG_INSPECTION: "0",
			CONFIG_RUNTIME_CPU_DETECT: "0",
			CONFIG_WEBM_IO: "0",

			CONFIG_MULTITHREAD: "0",
			CONFIG_AV1_HIGHBITDEPTH: "0",
		},
	});

	cmake({
		outFile: "vendor/libavif/libavif.a",
		src: "vendor/libavif",
		options: {
			BUILD_SHARED_LIBS: "0",
			AVIF_CODEC_AOM: "LOCAL",
			AVIF_LIBSHARPYUV: "LOCAL",
			LIBYUV_LIBRARY: "../libwebp/libsharpyuv.a",
			LIBYUV_INCLUDE_DIR: "../libwebp/sharpyuv",
		},
	});

	emcc("avif-enc.js", [
		"-I vendor/libavif/include",
		"cpp/avif_enc.cpp",
		"vendor/libavif/libavif.a",
		"vendor/libavif/ext/aom/build.libavif/libaom.a",
	]);
	emcc("avif-dec.js", [
		"-I vendor/libavif/include",
		"cpp/avif_dec.cpp",
		"vendor/libavif/libavif.a",
		"vendor/libavif/ext/aom/build.libavif/libaom.a",
	]);
}

export function buildWebP2() {
	gitClone(		"libwebp2"	);
	cmake({
		outFile: "vendor/wp2_build/libwebp2.a",
		src: "vendor/libwebp2",
		dist: "vendor/wp2_build",
		options: {
			WP2_BUILD_TESTS: "0",
			WP2_ENABLE_TESTS: "0",
			WP2_BUILD_EXAMPLES: "0",
			WP2_BUILD_EXTRAS: "0",
			// WP2_REDUCED: "1", // TODO: fails in vdebug.cc
			CMAKE_DISABLE_FIND_PACKAGE_Threads: "1",
			WP2_ENABLE_SIMD: "1",
		},
	});
	emcc("wp2-enc.js", [
		"-I vendor/libwebp2",
		"cpp/wp2_enc.cpp",
		"vendor/wp2_build/libwebp2.a",
	]);
	emcc("wp2-dec.js", [
		"-I vendor/libwebp2",
		"cpp/wp2_dec.cpp",
		"vendor/wp2_build/libwebp2.a",
	]);
}

function buildHEIC() {
	const x265Cached = gitClone("x265" );
	gitClone("libde265");
	gitClone("libheif");

	// Need delete x265/source/CmakeLists.txt lines 240-248 for 32-bit build.
	if (!x265Cached && !config.wasm64) {
		const text = readFileSync("vendor/x265/source/CmakeLists.txt", "utf8");
		const lines = text.split("\n");
		lines.splice(lines.indexOf("    elseif(X86 AND NOT X64)"), 9);
		writeFileSync("vendor/x265/source/CmakeLists.txt", lines.join("\n"));
	}

	cmake({
		outFile: "vendor/x265/source/libx265.a",
		src: "vendor/x265/source",
		options: {
			ENABLE_LIBNUMA: "0",
			ENABLE_SHARED: "0",
			ENABLE_CLI: "0",
			ENABLE_ASSEMBLY: "0",
		},
	});

	cmake({
		outFile: "vendor/libde265/libde265/libde265.a",
		src: "vendor/libde265",
		options: {
			BUILD_SHARED_LIBS: "0",
			ENABLE_SDL: "0",
			ENABLE_DECODER: "0",
		},
	});

	cmake({
		outFile: "vendor/libheif/libheif/libheif.a",
		src: "vendor/libheif",
		exceptions: true,
		options: {
			CMAKE_DISABLE_FIND_PACKAGE_Doxygen: "1",
			WITH_AOM_DECODER: "0",
			WITH_AOM_ENCODER: "0",
			WITH_EXAMPLES: "0",
			WITH_GDK_PIXBUF: "0",
			ENABLE_MULTITHREADING_SUPPORT: "0",
			BUILD_TESTING: "0",
			BUILD_SHARED_LIBS: "0",

			LIBSHARPYUV_INCLUDE_DIR: "vendor/libwebp",
			LIBSHARPYUV_LIBRARY: "vendor/libwebp/libsharpyuv.a",

			X265_INCLUDE_DIR: "vendor/x265/source",
			X265_LIBRARY: "vendor/x265/source/libx265.a",

			LIBDE265_INCLUDE_DIR: "vendor/libde265",
			LIBDE265_LIBRARY: "vendor/libde265/libde265/libde265.a",
		},
	});

	emcc("heic-enc.js", [
		"-s", "ENVIRONMENT=web,worker",
		"-I vendor/libheif",
		"-I vendor/libheif/libheif/api",
		"-pthread",
		"-fexceptions",
		"cpp/heic_enc.cpp",
		"vendor/libwebp/libsharpyuv.a",
		"vendor/x265/source/libx265.a",
		"vendor/libde265/libde265/libde265.a",
		"vendor/libheif/libheif/libheif.a",
	]);
}

function buildVVIC() {
	gitClone("libheif");
	gitClone("vvenc");

	cmake({
		outFile: "vendor/vvenc/vvenc.a",
		src: "vendor/vvenc",
		dist: "vendor/vvenc/build",
		options: {
			BUILD_SHARED_LIBS: "0",
			VVENC_ENABLE_INSTALL: "0",
			VVENC_ENABLE_THIRDPARTY_JSON: "0",
		},
	});
	cmake({
		outFile: "vendor/libheif/libheif/libheif.a",
		src: "vendor/libheif",
		options: {
			WITH_LIBSHARPYUV: "0",
			WITH_EXAMPLES: "0",
			WITH_GDK_PIXBUF: "0",
			ENABLE_MULTITHREADING_SUPPORT: "0",
			BUILD_TESTING: "0",
			BUILD_SHARED_LIBS: "0",

			WITH_VVENC: "1",
			VVENC_INCLUDE_DIR: "vendor/x265/source",
			VVENC_LIBRARY: "vendor/vvenc/vvenc.a",
		},
	});

	emcc("vvic-enc.js", [
		"-s", "ENVIRONMENT=web,worker",
		"-I vendor/libheif",
		"-I vendor/libheif/libheif/api",
		"-pthread",
		"cpp/vvic_enc.cpp",
		"vendor/vvenc/vvenc.a",
		"vendor/libheif/libheif/libheif.a",
	]);
}

// Equivalent to `if __name__ == "__main__":` in Python.
if (process.argv[1] === import.meta.filename) {
	buildWebP();
	buildAVIF();
	buildJXL();
	buildQOI();
	buildMozJPEG();
	buildWebP2();
	buildPNGQuant();

	// TODO: workers limit
	buildHEIC();

	// TODO: build failed.
	// buildVVIC();

	// await checkForUpdates();
}
