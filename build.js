import { createGunzip } from "zlib";
import * as tar from "tar-fs";
import { execSync } from 'child_process';
import { Readable } from "stream";
import { once } from "events";
import { existsSync } from "fs";
import { join } from "path";

async function downloadSource(name, url, strip = 1) {
	const outDir = join("vendor", name)
	if (existsSync(outDir)) {
		return;
	}
	const { body, ok, status } = await fetch(url);
	if (!ok) {
		throw new Error(`Assets download failed (${status}).`);
	}
	const extracting = Readable.fromWeb(body)
		.pipe(createGunzip())
		.pipe(tar.extract(outDir, { strip }));

	return once(extracting, "finish");
}

async function buildWebpEncoder() {
	await downloadSource("libwebp", "https://github.com/webmproject/libwebp/archive/refs/tags/v1.4.0.tar.gz")

	const args1 = [
		"emcmake",
		"cmake",
		".",

		"-DCMAKE_CXX_STANDARD=17",

		// Only build libsharpyuv, libwebp, libwebpdecoder, libwebpdemux
		"-DWEBP_BUILD_ANIM_UTILS=0",
		"-DWEBP_BUILD_CWEBP=0",
		"-DWEBP_BUILD_DWEBP=0",
		"-DWEBP_BUILD_GIF2WEBP=0",
		"-DWEBP_BUILD_IMG2WEBP=0",
		"-DWEBP_BUILD_VWEBP=0",
		"-DWEBP_BUILD_WEBPINFO=0",
		"-DWEBP_BUILD_LIBWEBPMUX=0",
		"-DWEBP_BUILD_WEBPMUX=0",
		"-DWEBP_BUILD_EXTRAS=0",
		"-DWEBP_USE_THREAD=0",

		// Enable SIMD
		"-DWEBP_ENABLE_SIMD=1",
	];
	execSync(args1.join(" "), { cwd: "vendor/libwebp", stdio: "inherit" })

	execSync("cmake --build .", { cwd: "vendor/libwebp", stdio: "inherit" })

	const args2 = [
		"emcc",
		"-O3",
		"--bind",
		"-s ALLOW_MEMORY_GROWTH=1",
		"-s ENVIRONMENT=web",
		"-s EXPORT_ES6=1",

		"-I vendor/libwebp",
		"-o lib/webp-enc.js",

		"src/webp_enc.cpp",
		"vendor/libwebp/libwebp.a",
		"vendor/libwebp/libsharpyuv.a",
	];

	execSync(args2.join(" "), { stdio: "inherit" })
}

// Must build WebP before to generate libsharpyuv.a
async function buildAVIF() {
	await downloadSource("libaom", "https://aomedia.googlesource.com/aom/+archive/v3.8.3.tar.gz", 0)
	await downloadSource("libavif", "https://github.com/AOMediaCodec/libavif/archive/refs/tags/v1.1.0.tar.gz")

	const argsAom = [
		"emcmake",
		"cmake",
		"../libaom",

		"-G Ninja",

		"-DCMAKE_CXX_STANDARD=17",

		"-DCMAKE_BUILD_TYPE=Release",
		"-DENABLE_CCACHE=0",
		"-DAOM_TARGET_CPU=generic",
		"-DENABLE_DOCS=0",
		"-DENABLE_TESTS=0",
		"-DENABLE_EXAMPLES=0",
		"-DENABLE_TOOLS=0",
		"-DCONFIG_ACCOUNTING=1",
		"-DCONFIG_INSPECTION=0",
		"-DCONFIG_RUNTIME_CPU_DETECT=0",
		"-DCONFIG_WEBM_IO=0",
	];
	execSync(argsAom.join(" "), { cwd: "vendor/aom_build", stdio: "inherit" })
	execSync("cmake --build .", { cwd: "vendor/aom_build", stdio: "inherit" })

	const argsAvif = [
		"emcmake",
		"cmake",
		".",

		"-DCMAKE_CXX_STANDARD=17",

		"-DCMAKE_BUILD_TYPE=Release",
		"-DBUILD_SHARED_LIBS=0",
		"-DAVIF_CODEC_AOM=1",
		"-DAOM_LIBRARY=../aom_build/libaom.a",
		"-DAOM_INCLUDE_DIR=../libaom",

		"-DLIBYUV_LIBRARY=../libwebp/libsharpyuv.a",
		"-DLIBYUV_INCLUDE_DIR=../libwebp/sharpyuv",

		"-DCONFIG_MULTITHREAD=0",
		"-DCONFIG_AV1_HIGHBITDEPTH=0",
	];
	execSync(argsAvif.join(" "), { cwd: "vendor/libavif", stdio: "inherit" })
	execSync("cmake --build .", { cwd: "vendor/libavif", stdio: "inherit" })

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
		"vendor/aom_build/libaom.a",
	];

	execSync(args2.join(" "), { stdio: "inherit" })
}

await downloadSource("libjxl", "https://github.com/libjxl/libjxl/archive/refs/tags/v0.8.3.tar.gz")

const args1 = [
	"emcmake",
	"cmake",
	".",

	"-DCMAKE_CXX_STANDARD=17",

	"-DBUILD_SHARED_LIBS=0",
	"-DJPEGXL_ENABLE_BENCHMARK=0",
	"-DJPEGXL_ENABLE_EXAMPLES=0",
	"-DBUILD_TESTING=0",
	"-DCMAKE_CROSSCOMPILING_EMULATOR=node",
];
execSync(args1.join(" "), { cwd: "vendor/libjxl", stdio: "inherit" })

execSync("cmake --build .", { cwd: "vendor/libjxl", stdio: "inherit" })

const args2 = [
	"emcc",
	"-O3",
	"--bind",
	"-s ALLOW_MEMORY_GROWTH=1",
	"-s ENVIRONMENT=web",
	"-s EXPORT_ES6=1",

	"-I vendor/libjxl/lib/include",
	"-o lib/jxl-enc.js",

	"src/jxl_enc.cpp",
	"vendor/libjxl/libjxl.a",
];

execSync(args2.join(" "), { stdio: "inherit" })
