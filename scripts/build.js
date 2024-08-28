import { execFileSync } from "node:child_process";
import { dirname } from "node:path";
import { renameSync, writeFileSync } from "node:fs";
import { cmake, config, emcc, removeRange, RepositoryManager, setHardwareConcurrency, wasmPack } from "./utils.js";

// Ensure we're on the project root directory.
process.chdir(dirname(import.meta.dirname));

const repositories = new RepositoryManager({
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
});

// It also builds libsharpyuv.a which used in other encoders.
function buildWebPLibrary() {
	cmake({
		outFile: "vendor/libwebp/libwebp.a",
		src: "vendor/libwebp",
		options: {
			WEBP_ENABLE_SIMD: 1,
			WEBP_BUILD_CWEBP: 0,
			WEBP_BUILD_DWEBP: 0,
			WEBP_BUILD_GIF2WEBP: 0,
			WEBP_BUILD_IMG2WEBP: 0,
			WEBP_BUILD_VWEBP: 0,
			WEBP_BUILD_WEBPINFO: 0,
			WEBP_BUILD_LIBWEBPMUX: 0,
			WEBP_BUILD_WEBPMUX: 0,
			WEBP_BUILD_EXTRAS: 0,
			WEBP_USE_THREAD: 0,
			WEBP_BUILD_ANIM_UTILS: 0,
		},
	});
}

export function buildMozJPEG() {
	cmake({
		outFile: "vendor/mozjpeg/libjpeg.a",
		src: "vendor/mozjpeg",
		options: {
			WITH_SIMD: 0,
			ENABLE_SHARED: 0,
			WITH_TURBOJPEG: 0,
			PNG_SUPPORTED: 0,
		},
	});
	execFileSync("emcc", ["rdswitch.c", "-O3", "-c"], {
		stdio: "inherit",
		shell: true,
		cwd: "vendor/mozjpeg",
	});
	emcc("cpp/mozjpeg.cpp", [
		"-I vendor/mozjpeg",
		"vendor/mozjpeg/libjpeg.a",
		"vendor/mozjpeg/rdswitch.o",
	]);
}

export function buildPNGQuant() {
	wasmPack("rust");
	// `--out-dir` cannot be out of the rust workspace.
	renameSync("rust/pkg/pngquant.js", `${config.outDir}/pngquant.js`);
	renameSync("rust/pkg/pngquant_bg.wasm", `${config.outDir}/pngquant_bg.wasm`);
}

export function buildQOI() {
	emcc("cpp/qoi.cpp", ["-I vendor/qoi"]);
}

export function buildWebP() {
	buildWebPLibrary();
	emcc("cpp/webp_enc.cpp", [
		"-I vendor/libwebp",
		"vendor/libwebp/libwebp.a",
		"vendor/libwebp/libsharpyuv.a",
	]);
	emcc("cpp/webp_dec.cpp", [
		"-I vendor/libwebp",
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
			BUILD_SHARED_LIBS: 0,
			BUILD_TESTING: 0,
			JPEGXL_BUNDLE_LIBPNG: 0,
			JPEGXL_ENABLE_JPEGLI: 0,
			JPEGXL_ENABLE_SJPEG: 0,
			JPEGXL_ENABLE_JNI: 0,
			JPEGXL_ENABLE_MANPAGES: 0,
			JPEGXL_ENABLE_TOOLS: 0,
			JPEGXL_ENABLE_BENCHMARK: 0,
			JPEGXL_ENABLE_DOXYGEN: 0,
			JPEGXL_ENABLE_EXAMPLES: 0,
		},
	});
	const includes = [
		"-I vendor/libjxl/third_party/highway",
		"-I vendor/libjxl/lib/include",
		"vendor/libjxl/lib/libjxl.a",
		"vendor/libjxl/lib/libjxl_cms.a",
		"vendor/libjxl/third_party/brotli/libbrotlidec.a",
		"vendor/libjxl/third_party/brotli/libbrotlienc.a",
		"vendor/libjxl/third_party/brotli/libbrotlicommon.a",
		"vendor/libjxl/third_party/highway/libhwy.a",
	];
	emcc("cpp/jxl_enc.cpp", includes);
	emcc("cpp/jxl_dec.cpp", includes);
}

function buildAVIFPartial(isEncode) {
	const typeName = isEncode ? "enc" : "dec";
	cmake({
		outFile: `vendor/aom/${typeName}-build/libaom.a`,
		src: "vendor/aom",
		dist: `vendor/aom/${typeName}-build`,
		options: {
			ENABLE_CCACHE: 0,
			AOM_TARGET_CPU: "generic",
			AOM_EXTRA_C_FLAGS: "-UNDEBUG",
			AOM_EXTRA_CXX_FLAGS: "-UNDEBUG",
			ENABLE_DOCS: 0,
			ENABLE_TESTS: 0,
			ENABLE_EXAMPLES: 0,
			ENABLE_TOOLS: 0,
			CONFIG_ACCOUNTING: 1,
			CONFIG_INSPECTION: 0,
			CONFIG_RUNTIME_CPU_DETECT: 0,
			CONFIG_WEBM_IO: 0,

			CONFIG_MULTITHREAD: 0,

			// TODO: memory access out of bounds when decoding 12bit image
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
			BUILD_SHARED_LIBS: 0,
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
	emcc(`cpp/avif_${typeName}.cpp`, [
		"-I vendor/libavif/include",
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
	removeRange("vendor/libwebp2/CMakeLists.txt",
		"# build the imageio library", "\n# #######");
	cmake({
		outFile: "vendor/wp2_build/libwebp2.a",
		src: "vendor/libwebp2",
		dist: "vendor/wp2_build",
		options: {
			WP2_BUILD_EXAMPLES: 0,
			WP2_BUILD_TESTS: 0,
			WP2_ENABLE_TESTS: 0,
			WP2_BUILD_EXTRAS: 0,
			WP2_ENABLE_SIMD: 1,
			CMAKE_DISABLE_FIND_PACKAGE_Threads: 1,

			// Fails in vdebug.cc
			// WP2_REDUCED: 1,
		},
	});
	emcc("cpp/wp2_enc.cpp", [
		"-I vendor/libwebp2",
		"vendor/wp2_build/libwebp2.a",
	]);
	emcc("cpp/wp2_dec.cpp", [
		"-I vendor/libwebp2",
		"vendor/wp2_build/libwebp2.a",
	]);
}

function buildHEICPartial(isEncode) {
	const typeName  = isEncode ? "heic_enc" : "heic_dec";
	cmake({
		outFile: `vendor/${typeName}/libheif/libheif.a`,
		src: "vendor/libheif",
		dist: "vendor/" + typeName,
		exceptions: true,
		options: {
			CMAKE_DISABLE_FIND_PACKAGE_Doxygen: 1,
			WITH_AOM_DECODER: 0,
			WITH_AOM_ENCODER: 0,
			WITH_EXAMPLES: 0,
			WITH_GDK_PIXBUF: 0,
			ENABLE_MULTITHREADING_SUPPORT: 0,
			BUILD_TESTING: 0,
			BUILD_SHARED_LIBS: 0,

			...(isEncode ? {
				LIBSHARPYUV_INCLUDE_DIR: "vendor/libwebp",
				LIBSHARPYUV_LIBRARY: "vendor/libwebp/libsharpyuv.a",

				X265_INCLUDE_DIR: "vendor/x265/source",
				X265_LIBRARY: "vendor/x265/source/libx265.a",
			}: {
				LIBDE265_INCLUDE_DIR: "vendor/libde265",
				LIBDE265_LIBRARY: "vendor/libde265/libde265/libde265.a",
			}),
		},
	});
}

function buildHEIC() {
	// Must delete x265/source/CmakeLists.txt lines 240-248 for 32-bit build.
	if (!config.wasm64) {
		removeRange("vendor/x265/source/CmakeLists.txt",
			"\n    elseif(X86 AND NOT X64)", "\n    endif()");
	}

	buildWebPLibrary();

	// TODO: thread count limit
	cmake({
		outFile: "vendor/x265/source/libx265.a",
		src: "vendor/x265/source",
		options: {
			ENABLE_LIBNUMA: 0,
			ENABLE_SHARED: 0,
			ENABLE_CLI: 0,
			ENABLE_ASSEMBLY: 0,
		},
	});
	cmake({
		outFile: "vendor/libde265/libde265/libde265.a",
		src: "vendor/libde265",
		options: {
			BUILD_SHARED_LIBS: 0,
			ENABLE_SDL: 0,
			ENABLE_DECODER: 0,
		},
	});

	buildHEICPartial(true);
	buildHEICPartial(false);

	emcc("cpp/heic_enc.cpp", [
		"-s", "ENVIRONMENT=web,worker",
		"-I vendor/libheif",
		"-I vendor/libheif/libheif/api",
		"-pthread",
		"-s", "PTHREAD_POOL_SIZE=2",
		"-fexceptions",
		"vendor/libwebp/libsharpyuv.a",
		"vendor/x265/source/libx265.a",
		"vendor/heic_enc/libheif/libheif.a",
	]);

	emcc("cpp/heic_dec.cpp", [
		"-s", "ENVIRONMENT=web",
		"-I vendor/libheif",
		"-I vendor/libheif/libheif/api",
		"-fexceptions",
		"vendor/libde265/libde265/libde265.a",
		"vendor/heic_dec/libheif/libheif.a",
	]);

	setHardwareConcurrency("dist/heic-enc.js", 1);
}

function buildVVIC() {
	// If build failed, try to delete "use ccache" section in CMakeLists.txt
	removeRange("vendor/vvdec/CMakeLists.txt", "\n# use ccache", "\n\n");
	cmake({
		outFile: "vendor/vvdec/lib/release-static/libvvdec.a",
		src: "vendor/vvdec",
		exceptions: true,
	});

	removeRange("vendor/vvenc/CMakeLists.txt", "\n# use ccache", "\n\n");
	cmake({
		outFile: "vendor/vvenc/lib/release-static/libvvenc.a",
		src: "vendor/vvenc",
		exceptions: true,
		options: {
			// Some instructions are not supported in WASM.
			VVENC_ENABLE_X86_SIMD: 0,
			BUILD_SHARED_LIBS: 0,
			VVENC_ENABLE_INSTALL: 0,
			VVENC_ENABLE_THIRDPARTY_JSON: 0,
		},
	});

	cmake({
		outFile: "vendor/libheif-vvic/libheif/libheif.a",
		src: "vendor/libheif",
		dist: "vendor/libheif-vvic",
		options: {
			CMAKE_DISABLE_FIND_PACKAGE_Doxygen: 1,
			WITH_AOM_DECODER: 0,
			WITH_AOM_ENCODER: 0,
			WITH_X265: 0,
			WITH_LIBDE265: 0,
			WITH_EXAMPLES: 0,
			WITH_GDK_PIXBUF: 0,
			ENABLE_MULTITHREADING_SUPPORT: 0,
			BUILD_TESTING: 0,
			BUILD_SHARED_LIBS: 0,

			LIBSHARPYUV_INCLUDE_DIR: "vendor/libwebp",
			LIBSHARPYUV_LIBRARY: "vendor/libwebp/libsharpyuv.a",

			// TODO: cannot find modules
			WITH_VVENC: 1,
			WITH_VVDEC: 1,

			vvenc_INCLUDE_DIR: "vendor/vvenc/include",
			vvenc_LIBRARY: "vendor/vvenc/lib/release-static/libvvenc.a",

			vvdec_INCLUDE_DIR: "vendor/vvdec/include",
			vvdec_LIBRARY: "vendor/vvdec/lib/release-static/libvvdec.a",
		},
	});

	emcc("cpp/vvic.cpp", [
		"-s", "ENVIRONMENT=web,worker",
		"-I vendor/libheif",
		"-I vendor/libheif/libheif/api",
		"-pthread",
		"vendor/libheif/libheif/libheif.a",
		"vendor/vvenc/lib/release-static/libvvenc.a",
		"vendor/vvdec/lib/release-static/libvvdec.a",
	]);
}

// config.rebuild = true;
// config.debug = true;

// Equivalent to `if __name__ == "__main__":` in Python.
if (process.argv[1] === import.meta.filename) {
	repositories.download();
	buildWebP();
	buildAVIF();
	buildJXL();
	buildQOI();
	buildMozJPEG();
	buildWebP2();
	buildHEIC();
	buildPNGQuant();

	// buildVVIC();

	// await repositories.checkUpdate();
}