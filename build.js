import { execFileSync } from "child_process";
import { join } from "path";
import { cpus } from "os";
import { existsSync, mkdirSync, renameSync } from "fs";

export const config = {
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
	 * Specify -G parameter of cmake, e.g. "Visual Studio 17 2022"
	 */
	cmakeBuilder: null,

	/**
	 * The maximum number of concurrent processes to use when building.
	 */
	parallel: cpus().length,
};

mkdirSync("dist", { recursive: true });

function gitClone(directory, branch, url) {
	if (existsSync(directory)) {
		return;
	}
	execFileSync("git", ["-c", "advice.detachedHead=false", "clone", "--depth", "1", "--branch", branch, url, directory]);
	execFileSync("git", ["submodule", "update", "--init", "--depth", "1", "--recursive"], { cwd: directory });
}

function cmake(checkFile, src, dist, options) {
	if (!config.rebuild && existsSync(checkFile)) {
		return;
	}
	const args = [
		"cmake", "-S", src, "-B", dist, "--fresh",
		"-Wno-dev", "-DCMAKE_WARN_DEPRECATED=OFF",
	];
	if (config.cmakeBuilder) {
		args.push("-G", `"${config.cmakeBuilder}"`);
	}
	if (config.wasm64) {
		args.push("-DCMAKE_C_FLAGS=-sMEMORY64");
		args.push("-DCMAKE_CXX_FLAGS=-sMEMORY64");
	}
	if (config.debug) {
		args.push("-DCMAKE_BUILD_TYPE=Debug");
	}
	for (const [k, v] of Object.entries(options)) {
		args.push(`-D${k}=${v}`);
	}
	execFileSync("emcmake", args, { stdio: "inherit", shell: true });

	const buildArgs = ["--build", ".", "-j", config.parallel];
	execFileSync("cmake", buildArgs, { cwd: dist, stdio: "inherit" });
}

function emcc(output, sourceArguments) {
	output = "dist/" + output;
	const args = [
		config.debug ? "-g" : "-O3",
		"--bind",
		// "--std=c++23",
		"-s", "NODEJS_CATCH_EXIT=0",
		"-s", "NODEJS_CATCH_REJECTION=0",
		"-s", "FILESYSTEM=0",
		"-s", "TEXTDECODER=2",
		"-s", "ENVIRONMENT=web",
		"-s", "ALLOW_MEMORY_GROWTH=1",
		"-s", "EXPORT_ES6=1",
		"-I", "cpp",
		"-o", output,
		...sourceArguments,
	];
	if (config.wasm64) {
		args.push("-s", "MEMORY64=1");
	}
	execFileSync("emcc", args, { stdio: "inherit", shell: true });
	console.info(`Successfully build WASM module: ${output}`);
}

// ============================== Build Coders ==============================

export function buildMozJPEG() {
	gitClone("vendor/mozjpeg", "v4.1.5", "https://github.com/mozilla/mozjpeg");
	cmake("vendor/mozjpeg/libjpeg.a", "vendor/mozjpeg", "vendor/mozjpeg", {
		WITH_SIMD: "0",
		ENABLE_SHARED: "0",
		WITH_TURBOJPEG: "0",
		PNG_SUPPORTED: "0",
	});
	emcc("jpeg-enc.js", [
		"-I vendor/mozjpeg",
		"cpp/mozjpeg_enc.cpp",
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
	renameSync("rust/pkg/png.js", "dist/png.js");
	renameSync("rust/pkg/png_bg.wasm", "dist/png_bg.wasm");
}

export function buildQOI() {
	gitClone("vendor/qoi", "master", "https://github.com/phoboslab/qoi");
	emcc("qoi.js", ["-I vendor/qoi", "cpp/qoi.cpp"]);
}

export function buildWebP() {
	gitClone("vendor/libwebp", "v1.4.0", "https://github.com/webmproject/libwebp");
	cmake("vendor/libwebp/libwebp.a", "vendor/libwebp", "vendor/libwebp", {
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
	gitClone("vendor/libjxl", "v0.8.3", "https://github.com/libjxl/libjxl");
	cmake("vendor/libjxl/lib/libjxl.a", "vendor/libjxl", "vendor/libjxl", {
		BUILD_SHARED_LIBS: "0",
		BUILD_TESTING: "0",
		JPEGXL_ENABLE_JNI: "0",
		JPEGXL_ENABLE_BENCHMARK: "0",
		JPEGXL_ENABLE_DOXYGEN: "0",
		JPEGXL_ENABLE_EXAMPLES: "0",
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
	gitClone("vendor/libavif", "v1.1.0", "https://github.com/AOMediaCodec/libavif");
	gitClone("vendor/libavif/ext/aom", "v3.9.1", "https://aomedia.googlesource.com/aom");

	mkdirSync("vendor/libavif/ext/aom/build.libavif", { recursive: true });
	cmake(
		"vendor/libavif/ext/aom/build.libavif/libaom.a",
		"vendor/libavif/ext/aom",
		"vendor/libavif/ext/aom/build.libavif",
		{
			CMAKE_BUILD_TYPE: "Release",
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
	);

	cmake("vendor/libavif/libavif.a", "vendor/libavif", "vendor/libavif", {
		BUILD_SHARED_LIBS: "0",
		AVIF_CODEC_AOM: "LOCAL",
		AVIF_LOCAL_LIBSHARPYUV: "1",
		LIBYUV_LIBRARY: "../libwebp/libsharpyuv.a",
		LIBYUV_INCLUDE_DIR: "../libwebp/sharpyuv",
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
	gitClone(
		"vendor/libwebp2",
		"main",
		"https://chromium.googlesource.com/codecs/libwebp2",
	);
	// mkdirSync("vendor/wp2_build", { recursive: true });

	cmake("vendor/wp2_build/libwebp2.a", "vendor/libwebp2", "vendor/wp2_build", {
		WP2_BUILD_TESTS: "0",
		WP2_ENABLE_TESTS: "0",
		WP2_BUILD_EXAMPLES: "0",
		WP2_BUILD_EXTRAS: "0",
		// WP2_REDUCED: "1", // TODO: fails in vdebug.cc
		CMAKE_DISABLE_FIND_PACKAGE_Threads: "1",
		WP2_ENABLE_SIMD: "1",
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

// Equivalent to `if __name__ == "__main__":` in Python.
if (process.argv[1] === import.meta.filename) {
	buildWebP();
	buildAVIF();
	buildJXL();
	buildQOI();
	buildPNGQuant();
	buildMozJPEG();
	buildWebP2();

	// checkForUpdate();
}
