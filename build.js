import { execFileSync, execSync } from "child_process";
import { existsSync, mkdirSync, renameSync } from "fs";
import { join } from "path";

// Must build WebP before to generate libsharpyuv.a
async function buildAVIF() {
	await downloadSource("libavif/ext/aom", "https://aomedia.googlesource.com/aom/+archive/v3.9.1.tar.gz", 0);
	await downloadSource("libavif", "https://github.com/AOMediaCodec/libavif/archive/refs/tags/v1.1.0.tar.gz");

	mkdirSync("vendor/libavif/ext/aom/build.libavif", { recursive: true });

	const argsAom = [
		"emcmake", "cmake",
		"-S .",
		"-B build.libavif",

		// "-DCMAKE_CXX_STANDARD=17",

		"-DCMAKE_BUILD_TYPE=Release",
		"-DENABLE_CCACHE=0",
		"-DAOM_TARGET_CPU=generic",
		"-DAOM_EXTRA_C_FLAGS=-UNDEBUG",
		"-DAOM_EXTRA_CXX_FLAGS=-UNDEBUG",
		"-DENABLE_DOCS=0",
		"-DENABLE_TESTS=0",
		"-DENABLE_EXAMPLES=0",
		"-DENABLE_TOOLS=0",
		"-DCONFIG_ACCOUNTING=1",
		"-DCONFIG_INSPECTION=0",
		"-DCONFIG_RUNTIME_CPU_DETECT=0",
		"-DCONFIG_WEBM_IO=0",

		"-DCONFIG_MULTITHREAD=0",
		"-DCONFIG_AV1_HIGHBITDEPTH=0",
	];
	// execSync(argsAom.join(" "), { cwd: "vendor/libavif/ext/aom", stdio: "inherit" })
	// execSync("cmake --build .", { cwd: "vendor/libavif/ext/aom/build.libavif", stdio: "inherit" })

	const argsAvif = [
		"emcmake", "cmake", ".",

		// "-DCMAKE_BUILD_TYPE=Release",
		"-DBUILD_SHARED_LIBS=0",
		"-DAVIF_CODEC_AOM=LOCAL",
		// "-DAVIF_LOCAL_AOM=1",
		"-DAVIF_LOCAL_LIBSHARPYUV=1",

		// "-DAOM_LIBRARY=vendor/ext/aom/build.libavif/libaom.a",
		// "-DAOM_INCLUDE_DIR=../libaom",

		"-DLIBYUV_LIBRARY=../libwebp/libsharpyuv.a",
		"-DLIBYUV_INCLUDE_DIR=../libwebp/sharpyuv",
	];
	execSync(argsAvif.join(" "), { cwd: "vendor/libavif", stdio: "inherit" });
	execSync("cmake --build .", { cwd: "vendor/libavif", stdio: "inherit" });

	const args2 = [
		"emcc",
		"-O3",
		"--bind",
		"-s ALLOW_MEMORY_GROWTH=1",
		"-s ENVIRONMENT=web",
		"-s EXPORT_ES6=1",

		"-I vendor/libavif/include",
		"-o lib/avif-enc.js",

		"src/avif_enc.cpp",
		"vendor/libavif/libavif.a",
		"vendor/libavif/ext/aom/build.libavif/libaom.a",
	];

	execSync(args2.join(" "), { stdio: "inherit" });
}

async function buildWebP2() {
	await downloadSource("libwebp2", "https://chromium.googlesource.com/codecs/libwebp2/+archive/9dd38de9c8905af1eab0914fd40531e970b309c5.tar.gz", 0);
	mkdirSync("vendor/wp2_build", { recursive: true });

	const args1 = [
		"emcmake", "cmake", "-S ../libwebp2", "-B .",

		"-DWP2_BUILD_TESTS=0",
		"-DWP2_ENABLE_TESTS=0",
		"-DWP2_BUILD_EXAMPLES=0",
		"-DWP2_BUILD_EXTRAS=0",
		"-DWP2_REDUCED=1",

		"-DCMAKE_DISABLE_FIND_PACKAGE_Threads=1",
		"-DWP2_ENABLE_SIMD=1",
	];
	execSync(args1.join(" "), { cwd: "vendor/wp2_build", stdio: "inherit" });
	execSync("cmake --build .", { cwd: "vendor/wp2_build", stdio: "inherit" });

	const args2 = [
		"emcc",
		"-O3",
		"--bind",
		"-s ALLOW_MEMORY_GROWTH=1",
		"-s ENVIRONMENT=web",
		"-s EXPORT_ES6=1",

		"-I vendor/libwebp2/src/wp2",
		"-o lib/wp2-enc.js",

		"src/wp2_enc.cpp",
		"vendor/wp2_build/libwebp2.a",
	];

	execSync(args2.join(" "), { stdio: "inherit" });
}

function buildMozJPEG() {
	gitClone("mozjpeg","v4.1.5","https://github.com/mozilla/mozjpeg");
	cmake("vendor/mozjpeg/libjpeg.a", "vendor/mozjpeg", "vendor/mozjpeg", {
		WITH_SIMD: "0",
		ENABLE_SHARED: "0",
		WITH_TURBOJPEG: "0",
		PNG_SUPPORTED: "0",
	});
	emcc([
		"-I vendor/mozjpeg",
		"-o dist/mozjpeg-enc.js",

		"cpp/mozjpeg_enc.cpp",
		"vendor/mozjpeg/libjpeg.a",
		"vendor/mozjpeg/rdswitch.c",
	]);
}

let cmakeBuilder = null;

function gitClone(directory, branch, url) {
	if (!existsSync(directory)) {
		execSync(`git clone --depth 1 --branch ${branch} ${url} ${directory}`);
		execSync("git submodule update --init --depth 1 --recursive", { cwd: directory });
	}
}

function emcc(userArguments) {
	const args = [
		"emcc", "-O3", "--bind",
		"-s ENVIRONMENT=web",
		"-s ALLOW_MEMORY_GROWTH=1",
		"-s EXPORT_ES6=1",
		"-I cpp",
		...userArguments,
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
	execSync("cmake --build .", { cwd: src, stdio: "inherit" });
}

function buildQOI() {
	gitClone("vendor/qoi", "master", "https://github.com/phoboslab/qoi");
	emcc(["-I vendor/qoi", "-o dist/qoi.js", "cpp/qoi.cpp"]);
}

async function buildWebpEncoder() {
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

	emcc([
		"-o dist/webp-enc.js",
		"-I vendor/libwebp",
		"cpp/webp_enc.cpp",
		"vendor/libwebp/libwebp.a",
		"vendor/libwebp/libsharpyuv.a",
	]);
}

function buildJXLEncoder() {
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
	emcc([
		"-I vendor/libjxl",
		"-I vendor/libjxl/lib/include",
		"-I vendor/libjxl/third_party/highway",
		"-I vendor/libjxl/third_party/skcms",

		"-o dist/jxl-enc.js",

		"cpp/jxl_enc.cpp",
		"vendor/libjxl/lib/libjxl.a",
		"vendor/libjxl/third_party/brotli/libbrotlidec-static.a",
		"vendor/libjxl/third_party/brotli/libbrotlienc-static.a",
		"vendor/libjxl/third_party/brotli/libbrotlicommon-static.a",
		"vendor/libjxl/third_party/libskcms.a",
		"vendor/libjxl/third_party/highway/libhwy.a",
	]);
}

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

// cmake("vendor/mozjpeg", mozjpeg, true);
// cmake("vendor/libjxl", libjxl);
// cmake("vendor/qoi", qoi);
// buildWebpEncoder();

function buildPNGQuant() {
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

// buildPNGQuant();
// buildQOI();
buildWebpEncoder();
