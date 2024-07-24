import { execFileSync, execSync } from "child_process";
import { existsSync, mkdirSync, renameSync } from "fs";
import { join } from "path";

function detectVisualStudio() {
	const pf32 = process.env["ProgramFiles(x86)"];
	if (!pf32) {
		return;
	}
	const vswhere = `${pf32}/Microsoft Visual Studio/Installer/vswhere.exe`;
	const stdout = execFileSync(vswhere, { encoding: "utf8" });
	const properties = Object.fromEntries(stdout.split("\r\n").map(line => line.split(": ")));

	const path = properties.resolvedInstallationPath;
	return {
		version: parseInt(properties.installationVersion),
		path,
		clang: path + "/VC/Tools/Llvm/x64/bin",
		productVersion: properties.catalog_productLineVersion,
	};
}

let clangDirectory;

if (process.platform === "win32") {
	const vs = detectVisualStudio();
	clangDirectory = vs.clang;
}

let cmakeBuilder = null;

function gitClone(directory, branch, url) {
	if (!existsSync(directory)) {
		execSync(`git clone --depth 1 --branch ${branch} ${url} ${directory}`);
		execSync("git submodule update --init --depth 1 --recursive", { cwd: directory });
	}
}

function emcc(output, inputArguments) {
	output = "dist/" + output;
	if (existsSync(output)) {
		return;
	}
	const args = [
		"emcc", "-O3", "--bind",
		"-s ENVIRONMENT=web",
		"-s ALLOW_MEMORY_GROWTH=1",
		"-s EXPORT_ES6=1",
		"-I cpp/icodec.h",
		"-o", output,
		...inputArguments,
	];
	execSync(args.join(" "), { stdio: "inherit" });
}

function cmake(checkFile, src, dist, options) {
	if (existsSync(checkFile)) {
		return;
	}
	const args = ["emcmake", "cmake", `-S ${src}`, `-B ${dist}`];
	if (cmakeBuilder) {
		args.push(`-G "${cmakeBuilder}"`);
	}
	for (const [k, v] of Object.entries(options ?? {})) {
		args.push(`-D${k}=${v}`);
	}
	execSync(args.join(" "), { stdio: "inherit" });
	execSync("cmake --build .", { cwd: dist, stdio: "inherit" });
}

export function buildMozJPEG() {
	gitClone("vendor/mozjpeg", "v4.1.5", "https://github.com/mozilla/mozjpeg");
	cmake("vendor/mozjpeg/libjpeg.a", "vendor/mozjpeg", "vendor/mozjpeg", {
		WITH_SIMD: "0",
		ENABLE_SHARED: "0",
		WITH_TURBOJPEG: "0",
		PNG_SUPPORTED: "0",
	});
	emcc("mozjpeg-enc.js", [
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
		// "--dev",
		"--no-typescript",
		"--no-pack",
		"--reference-types",
		"--weak-refs",
		"--target", "web",
	];
	execFileSync("wasm-pack", args, { stdio: "inherit", env });

	renameSync("rust/pkg/pngquant.js", "dist/pngquant.js");
	renameSync("rust/pkg/pngquant_bg.wasm", "dist/pngquant_bg.wasm");
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
	gitClone("libjxl", "v0.8.3", "https://github.com/libjxl/libjxl");
	cmake("vendor/libjxl/lib/libjxl.a", "vendor/libjxl", "vendor/libjxl", {
		BUILD_SHARED_LIBS: "0",
		BUILD_TESTING: "0",
		JPEGXL_ENABLE_BENCHMARK: "0",
		JPEGXL_ENABLE_EXAMPLES: "0",
		JPEGXL_ENABLE_DOXYGEN: "0",
		JPEGXL_ENABLE_JNI: "0",
	});
	execSync("emcc -Wall -O3 -o vendor/libjxl/third_party/skcms/skcms.cc.o -I vendor/libjxl/third_party/skcms -c vendor/libjxl/third_party/skcms/skcms.cc");
	execSync(`"${clangDirectory}/llvm-ar" rc vendor/libjxl/third_party/libskcms.a vendor/libjxl/third_party/skcms/skcms.cc.o`);
	emcc("jxl-enc.js", [
		"-I vendor/libjxl",
		"-I vendor/libjxl/lib/include",
		"-I vendor/libjxl/third_party/highway",
		"-I vendor/libjxl/third_party/skcms",

		"cpp/jxl_enc.cpp",
		"vendor/libjxl/lib/libjxl.a",
		"vendor/libjxl/third_party/brotli/libbrotlidec-static.a",
		"vendor/libjxl/third_party/brotli/libbrotlienc-static.a",
		"vendor/libjxl/third_party/brotli/libbrotlicommon-static.a",
		"vendor/libjxl/third_party/libskcms.a",
		"vendor/libjxl/third_party/highway/libhwy.a",
	]);
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

		"src/avif_enc.cpp",
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

	mkdirSync("vendor/wp2_build", { recursive: true });

	cmake("vendor/wp2_build/libwebp2.a", "vendor/libwebp2", "vendor/wp2_build", {
		WP2_BUILD_TESTS: "0",
		WP2_ENABLE_TESTS: "0",
		WP2_BUILD_EXAMPLES: "0",
		WP2_BUILD_EXTRAS: "0",
		WP2_REDUCED: "1",
		CMAKE_DISABLE_FIND_PACKAGE_Threads: "1",
		WP2_ENABLE_SIMD: "1",
	});

	emcc("wp2-enc.js", [
		"-I vendor/libwebp2/src/wp2",
		"src/wp2_enc.cpp",
		"vendor/wp2_build/libwebp2.a",
	]);
}

// Equivalent to `if __name__ == "__main__":` in Python.
if (process.argv[1] === import.meta.filename) {
	buildWebP();
	buildAVIF();
	buildWebP2();
	buildJXL();
	buildQOI();
	buildPNGQuant();
	buildMozJPEG();
}
