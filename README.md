# icodec

[![NPM Version](https://img.shields.io/npm/v/icodec?style=flat-square)](https://www.npmjs.com/package/icodec)

Image encoders & decoders built with WebAssembly.

<table>
    <thead>
        <tr><th>Module</th><th>Encoder</th><th>Decoder</th></tr>
    </thead>
    <tbody>
        <tr>
            <td>jpeg</td>
            <td colspan='2'>
                <a href='https://github.com/mozilla/mozjpeg'>MozJPEG</a>
            </td>
        </tr>
        <tr>
            <td>png</td>
            <td>
                <a href='https://github.com/shssoichiro/oxipng'>OxiPNG</a> 
                + 
                <a href='https://github.com/ImageOptim/libimagequant'>imagequant</a>
            </td>
            <td>
                <a href='https://github.com/image-rs/image-png'>image-png</a>
            </td>
        </tr>
        <tr>
            <td>qoi</td>
            <td colspan='2'>
                <a href='https://github.com/phoboslab/qoi'>qoi</a>
            </td>
        </tr>
        <tr>
            <td>webp</td>
            <td colspan='2'>
                <a href='https://chromium.googlesource.com/webm/libwebp'>libwebp</a>
            </td>  
        </tr>
        <tr>
            <td>heic</td>
            <td>
                <a href='https://github.com/strukturag/libheif'>libheif</a>
                +
                <a href='https://bitbucket.org/multicoreware/x265_git/src'>x265</a>
            </td>
            <td>
                <a href='https://github.com/strukturag/libheif'>libheif</a>
                +
                <a href='https://github.com/strukturag/libde265'>libde265</a>
            </td>
        </tr>
        <tr>
            <td>avif</td>
            <td colspan='2'>
                <a href='https://github.com/AOMediaCodec/libavif'>libavif</a>
                +
                <a href='https://aomedia.googlesource.com/aom'>aom</a>
            </td>
        </tr>
        <tr>
            <td>jxl</td>
            <td colspan='2'>
                <a href='https://github.com/libjxl/libjxl'>libjxl</a>
            </td>
        </tr>
        <tr>
            <td>wp2</td>
            <td colspan='2'>
                <a href='https://chromium.googlesource.com/codecs/libwebp2'>libwebp2</a>
            </td>
        </tr>
    </tbody>
</table>

> [!WARNING]
> Since libheif does not support specify thread count for x265 encoder, The `encode` of the heic module only work on webworker, and has performance issue.

# Usage

Requirement: The target environment must support [WebAssembly SIMD](https://caniuse.com/wasm-simd).

```shell
pnpm add icodec
```

Use in browser:

```javascript
// All codec modules (see the table above) are named export.
import { avif, jxl } from "icodec";

const response = await fetch("https://raw.githubusercontent.com/Kaciras/icodec/master/test/snapshot/image.avif")

// This should be called once before you invoke `decode()`
await avif.loadDecoder();

// Decode AVIF to ImageData.
const image = avif.decode(await response.arrayBuffer());

// Encode the image to JPEG XL, also need to load the encoder WASM first.
await jxl.loadEncoder();

/*
 * The image parameter must have properties:
 * {
 *     width: number;
 *     height: number;
 *     data: Uint8Array | Uint8ClampedArray;
 * }
 */
const encoded = jxl.encode(image, /*{ options }*/);
```

Each codec module exports:

```typescript
/**
 * Provides a uniform type for codec modules that support encoding.
 *
 * @example
 * import { wp2, ICodecModule } from "icodec";
 *
 * const encoder: ICodecModule<wp2.Options> = wp2;
 */
interface ICodecModule<T = any> {
  /**
   * The default options of `encode` function.
   */
  defaultOptions: Required<T>;

  /**
   * The MIME type string of the format.
   */
  mimeType: string;

  /**
   * File extension (without the dot) of this format.
   */
  extension: string;

  /**
   * Load the decoder WASM file, must be called once before decode.
   *
   * @param source If pass a string, it's the URL of WASM file to fetch,
   *               else it will be treated as the WASM bytes.
   * @return the underlying WASM module, which is not part of
   *               the public API and can be changed at any time.
   */
  loadDecoder(source?: WasmSource): Promise<any>;

  /**
   * Convert the image to raw RGBA data.
   */
  decode(input: Uint8Array): ImageData;

  /**
   * Load the encoder WASM file, must be called once before encode.
   *
   * @param source If pass a string, it's the URL of WASM file to fetch,
   *               else it will be treated as the WASM bytes.
   * @return the underlying WASM module, which is not part of
   *               the public API and can be changed at any time.
   */
  loadEncoder(source?: WasmSource): Promise<any>;

  /**
   * Encode an image with RGBA pixels data.
   */
  encode(image: ImageDataLike, options?: T): Uint8Array;
}
```

The `png` module export extra members:

```typescript
interface QuantizeOptions {
  /**
   * Range: [0, 10], bigger is faster and generate images of lower quality,
   * but may be useful for real-time generation of images.
   *
   * @default 4
   */
  speed?: number;
  /**
   * Range [0, 100], roughly like JPEG. the max 100 means best effort
   * If less than 100, the library will try to use fewer colors.
   *
   * Images with fewer colors are not always smaller, due to increased dithering it causes.
   *
   * @default 75
   */
  quality?: number;
  /**
   * If the minimum quality can't be met, the quantization will be aborted with an error.
   * Default is 0, which means never aborts the process.
   *
   * @default 0
   */
  min_quality?: number;
  /**
   * Range [0, 1] float, set to 1 to get nice smooth image.
   *
   * @default 1
   */
  dithering?: number;
}

/**
 * Reduces the colors used in the image at a slight loss, using a combination
 * of vector quantization algorithms.
 *
 * Can be used before other compression algorithm to boost compression ratio.
 */
declare function reduceColors(image: ImageDataLike, options?: QuantizeOptions): Uint8Array;
```

To use icodec in Node, just change the import specifier to `icodec/node`, and `loadEncoder`/`loadDecoder` will use `readFileSync` instead of `fetch`.

```javascript
import { avif, jxl } from "icodec/node";
```

If your bundler requires special handing of WebAssembly, you can pass the URL of WASM files to `load*` function. WASM files are exported in the format `icodec/<codec>-<enc|dec>.wasm`.

```javascript
import { avif, jxl } from "icodec";

// Example for Vite
import AVIFEncWASM from "icodec/avif-enc.wasm?url";
import JxlDecWASM from "icodec/jxl-dec.wasm?url";

await avif.loadDecoder(AVIFEncWASM);
await jxl.loadEncoder(JxlDecWASM);
```

# Contribute

To build WASM modules, you will need to install:

* [Cmake](https://cmake.org) >= 3.24
* [Rust](https://www.rust-lang.org/tools/install) & [wasm-pack](https://rustwasm.github.io/wasm-pack/installer)
* [Emscripten](https://emscripten.org/docs/getting_started/downloads.html)
* [Perl](https://www.perl.org)
* [Git](https://git-scm.com)
* A proper C/C++ compiler toolchain, depending on your operating system

Run the build script:

```shell
node build.js
```

TODOs:

* Could it be possible to remove HEIC & VVIC encoder dependency on pthread, or limit the number of threads?
* Cannot specify vvenc & vvdec paths for libheif build.

Rnn tests:

```shell
pnpm exec tsc
node --test test/test-*.js
```

Start web demo:

```shell
node start-demo.js
```
