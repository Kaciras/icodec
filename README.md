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
> Since libheif does not support specify thread count for x265 encoder, The `encode` of the `heic` module only work on webworker, and has performance issue.

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

Type of each codec module:

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
/**
 * Reduces the colors used in the image at a slight loss, using a combination
 * of vector quantization algorithms.
 *
 * Can be used before other compression algorithm to boost compression ratio.
 */
function reduceColors(image: ImageDataLike, options?: QuantizeOptions): Uint8Array;
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

# Performance

| No. |  Name | codec |        time |   time.SD | time.ratio | time.diff |
|----:|------:|------:|------------:|----------:|-----------:|----------:|
|   0 |  WASM |  avif |    47.49 ms |  65.17 us |   baseline |           |
|   1 | Sharp |  avif |    72.80 ms | 227.13 us |    +53.28% |           |
|     |       |       |             |           |            |           |
|   2 |  WASM |  jpeg | 7,731.74 us |  71.83 us |   baseline |           |
|   3 | Sharp |  jpeg |   797.59 us |   2.44 us |    -89.68% |           |
|     |       |       |             |           |            |           |
|   4 |  WASM |   jxl |    32.18 ms |  16.32 us |   baseline |           |
|     |       |       |             |           |            |           |
|   5 |  WASM |   png |    69.98 ms |  51.08 us |   baseline |           |
|   6 | Sharp |   png |    10.84 ms |  37.58 us |    -84.50% |           |
|     |       |       |             |           |            |           |
|   7 |  WASM |   qoi |   371.49 us |   1.10 us |   baseline |           |
|     |       |       |             |           |            |           |
|   8 |  WASM |  webp |     4.42 ms |   1.32 us |   baseline |    +0.38% |
|   9 | Sharp |  webp |     4.18 ms |  13.10 us |     -5.43% |           |
|     |       |       |             |           |            |           |
|  10 |  WASM |   wp2 |    89.79 ms | 133.27 us |   baseline |           |

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
