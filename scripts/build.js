import { execFile, execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { promisify } from "node:util";
import versionCompare from "version-compare";

// Ensure we're on the project root directory.
process.chdir(dirname(import.meta.dirname));

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

const repositories = {
	mozjpeg: ["v4.1.5", "https://github.com/mozilla/mozjpeg"],
	qoi: ["master", "https://github.com/phoboslab/qoi"],
	libwebp: ["v1.4.0", "https://github.com/webmproject/libwebp"],
	libjxl: ["v0.10.3", "https://github.com/libjxl/libjxl"],
	libavif: ["v1.1.1", "https://github.com/AOMediaCodec/libavif"],
	aom: ["v3.9.1", "https://aomedia.googlesource.com/aom"],
	libwebp2: [
		"b65d168d3b2b8f8ec849134da2c3a5f034f1eb42",
		"https://chromium.googlesource.com/codecs/libwebp2",
	],
	x265: ["3.6", "https://bitbucket.org/multicoreware/x265_git"],
	libde265: ["v1.0.15", "https://github.com/strukturag/libde265"],
	libheif: ["v1.18.1", "https://github.com/strukturag/libheif"],
	vvenc: ["v1.12.0", "https://github.com/fraunhoferhhi/vvenc"],
	vvdec: ["v2.3.0", "https://github.com/fraunhoferhhi/vvdec"],
};

mkdirSync(config.outDir, { recursive: true });

function downloadVendorSources() {
	for (const [key, [branch, url]] of Object.entries(repositories)) {
		const cwd = "vendor/" + key;
		if (existsSync(cwd)) {
			continue;
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
}

function patchFile(path, doPatch) {
	const backup = path + ".path_backup";
	if (existsSync(backup)) {
		return;
	}
	const content = doPatch(path);
	renameSync(path, backup);
	writeFileSync(path, content);
}

function cmake(settings) {
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

function emcc(output, sourceArguments) {
	output = join(config.outDir, output);
	const args = [
		"-o", output,
		"-I", "cpp",
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

function buildWebPLibrary() {
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
}

export function buildMozJPEG() {
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
	execFileSync("emcc", ["rdswitch.c", "-O3", "-c"], {
		stdio: "inherit",
		shell: true,
		cwd: "vendor/mozjpeg",
	});
	emcc("mozjpeg.js", [
		"-I vendor/mozjpeg",
		"cpp/mozjpeg.cpp",
		"vendor/mozjpeg/libjpeg.a",
		"vendor/mozjpeg/rdswitch.o",
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
	emcc("qoi.js", ["-I vendor/qoi", "cpp/qoi.cpp"]);
}

export function buildWebP() {
	buildWebPLibrary();
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
	// highway uses CJS scripts in build, but our project is ESM.
	writeFileSync("vendor/libjxl/third_party/highway/package.json", "{}");
	cmake({
		outFile: "vendor/libjxl/lib/libjxl.a",
		src: "vendor/libjxl",
		options: {
			BUILD_SHARED_LIBS: "0",
			BUILD_TESTING: "0",
			JPEGXL_BUNDLE_LIBPNG: "0",
			JPEGXL_ENABLE_JPEGLI: "0",
			JPEGXL_ENABLE_SJPEG: "0",
			JPEGXL_ENABLE_JNI: "0",
			JPEGXL_ENABLE_MANPAGES: "0",
			JPEGXL_ENABLE_TOOLS: "0",
			JPEGXL_ENABLE_BENCHMARK: "0",
			JPEGXL_ENABLE_DOXYGEN: "0",
			JPEGXL_ENABLE_EXAMPLES: "0",
		},
	});
	const includes = [
		"-I vendor/libjxl/third_party/highway",
		"-I vendor/libjxl",
		"-I vendor/libjxl/lib/include",
		"vendor/libjxl/lib/libjxl.a",
		"vendor/libjxl/lib/libjxl_cms.a",
		"vendor/libjxl/third_party/brotli/libbrotlidec.a",
		"vendor/libjxl/third_party/brotli/libbrotlienc.a",
		"vendor/libjxl/third_party/brotli/libbrotlicommon.a",
		"vendor/libjxl/third_party/highway/libhwy.a",
	];
	emcc("jxl-enc.js", [...includes, "cpp/jxl_enc.cpp"]);
	emcc("jxl-dec.js", [...includes, "cpp/jxl_dec.cpp"]);
}

function buildAVIFPartial(isEncode) {
	const typeName = isEncode ? "enc" : "dec";
	cmake({
		outFile: `vendor/aom/${typeName}-build/libaom.a`,
		src: "vendor/aom",
		dist: `vendor/aom/${typeName}-build`,
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
			CONFIG_AV1_HIGHBITDEPTH: 1 - isEncode,

			CONFIG_AV1_ENCODER: isEncode,
			CONFIG_AV1_DECODER: 1 - isEncode,
		},
	});
	cmake({
		outFile: `vendor/libavif/${typeName}-build/libavif.a`,
		src: "vendor/libavif",
		dist: `vendor/libavif/${typeName}-build`,
		options: {
			BUILD_SHARED_LIBS: "0",
			AVIF_CODEC_AOM: "SYSTEM",
			AOM_LIBRARY: `vendor/aom/${typeName}-build/libaom.a`,
			AOM_INCLUDE_DIR: "vendor/aom",

			AVIF_LIBYUV: "LOCAL",

			AVIF_LIBSHARPYUV: "SYSTEM",
			LIBSHARPYUV_LIBRARY: "vendor/libwebp/libsharpyuv.a",
			LIBSHARPYUV_INCLUDE_DIR: "vendor/libwebp",

			AVIF_CODEC_AOM_ENCODE: isEncode,
			AVIF_CODEC_AOM_DECODE: 1 - isEncode,
		},
	});
	emcc(`avif-${typeName}.js`, [
		"-I vendor/libavif/include",
		`cpp/avif_${typeName}.cpp`,
		"vendor/libwebp/libsharpyuv.a",
		`vendor/aom/${typeName}-build/libaom.a`,
		`vendor/libavif/${typeName}-build/libavif.a`,
	]);
}

export function buildAVIF() {
	buildWebPLibrary();
	buildAVIFPartial(1);
	buildAVIFPartial(0);
}

export function buildWebP2() {
	// libwebp2 does not provide switch for imageio library.
	patchFile("vendor/libwebp2/CMakeLists.txt", file => {
		const content = readFileSync(file, "utf8");
		const i = content.indexOf("# build the imageio library");
		const j = content.indexOf("\n# #######", i);
		return content.slice(0, i) + content.slice(j);
	});
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
	// Must delete x265/source/CmakeLists.txt lines 240-248 for 32-bit build.
	if (!config.wasm64) {
		patchFile("vendor/x265/source/CmakeLists.txt", file => {
			const content = readFileSync(file, "utf8");
			const i = content.indexOf("\n    elseif(X86 AND NOT X64)");
			const j = content.indexOf("\n    endif()", i);
			return content.slice(0, i) + content.slice(j);
		});
	}

	buildWebPLibrary();

	// TODO: thread count limit
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
	// If build failed, try to delete "use ccache" section in CMakeLists.txt
	cmake({
		outFile: "vendor/vvdec/lib/release-static/libvvdec.a",
		src: "vendor/vvdec",
		exceptions: true,
	});
	cmake({
		outFile: "vendor/vvenc/lib/release-static/libvvenc.a",
		src: "vendor/vvenc",
		exceptions: true,
		options: {
			// Some instructions are not supported in WASM.
			VVENC_ENABLE_X86_SIMD: "0",

			BUILD_SHARED_LIBS: "0",
			VVENC_ENABLE_INSTALL: "0",
			VVENC_ENABLE_THIRDPARTY_JSON: "0",
		},
	});

	cmake({
		outFile: "vendor/libheif-vvic/libheif/libheif.a",
		src: "vendor/libheif",
		dist: "vendor/libheif-vvic",
		options: {
			CMAKE_DISABLE_FIND_PACKAGE_Doxygen: "1",
			WITH_AOM_DECODER: "0",
			WITH_AOM_ENCODER: "0",
			WITH_X265: "0",
			WITH_LIBDE265: "0",
			WITH_EXAMPLES: "0",
			WITH_GDK_PIXBUF: "0",
			ENABLE_MULTITHREADING_SUPPORT: "0",
			BUILD_TESTING: "0",
			BUILD_SHARED_LIBS: "0",

			LIBSHARPYUV_INCLUDE_DIR: "vendor/libwebp",
			LIBSHARPYUV_LIBRARY: "vendor/libwebp/libsharpyuv.a",

			// TODO: cannot find modules
			WITH_VVENC: "1",
			WITH_VVDEC: "1",
		},
	});

	emcc("vvic-enc.js", [
		"-s", "ENVIRONMENT=web,worker",
		"-I vendor/libheif",
		"-I vendor/libheif/libheif/api",
		"-pthread",
		"cpp/vvic.cpp",
		"vendor/libheif/libheif/libheif.a",
		"vendor/vvenc/lib/release-static/libvvenc.a",
		"vendor/vvdec/lib/release-static/libvvdec.a",
	]);
}

// Equivalent to `if __name__ == "__main__":` in Python.
if (process.argv[1] === import.meta.filename) {
	downloadVendorSources();
	buildWebP();
	buildAVIF();
	buildJXL();
	buildQOI();
	buildMozJPEG();
	buildWebP2();
	buildHEIC();
	buildPNGQuant();

	// buildVVIC();

	// await checkForUpdates();
}
