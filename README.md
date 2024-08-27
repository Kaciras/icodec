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

icodec is aimed at the web platform and has some limitations:

* Decode output & Encode input only support RGBA format.
* No animated image support, you should use video instead.

# Usage

Requirement: The target environment must support [WebAssembly SIMD](https://caniuse.com/wasm-simd).

```shell
pnpm add icodec
```

Use in browser:

```javascript
// All codec modules (see the table above) are named export.
import { avif, jxl } from "icodec";

const response = await fetch("https://raw.githubusercontent.com/Kaciras/icodec/master/test/snapshot/image.avif");
const data = new Uint8Array(await response.arrayBuffer());

// This should be called once before you invoke `decode()`
await avif.loadDecoder();

// Decode AVIF to ImageData.
const image = avif.decode(data);

// This should be called once before you invoke `encode()`
await jxl.loadEncoder();

// Encode the image to JPEG XL.
const jxlData = jxl.encode(image, /*{ options }*/);
```

To use icodec in Node, just change the import specifier to `icodec/node`, and `loadEncoder`/`loadDecoder` will use `readFileSync` instead of `fetch`.

```javascript
import { avif, jxl } from "icodec/node";
```

If your bundler requires special handing of WebAssembly, you can pass the URL of WASM files to `load*` function. WASM files are exported in the format `icodec/<codec>-<enc|dec>.wasm`.

icodec is tree-shakable, with a bundler the unused code and wasm file can be eliminated from loading.

```javascript
import { avif, jxl } from "icodec";

// Example for Vite
import AVIFEncWASM from "icodec/avif-enc.wasm?url";
import JxlDecWASM from "icodec/jxl-dec.wasm?url";

await avif.loadDecoder(AVIFEncWASM);
await jxl.loadEncoder(JxlDecWASM);
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
   * Multiple calls are ignored, and return the first result.
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
   * Multiple calls are ignored, and return the first result.
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

The `png` module exports extra members:

```typescript
/**
 * Reduces the colors used in the image at a slight loss, using a combination
 * of vector quantization algorithms.
 *
 * Can be used before other compression algorithm to boost compression ratio.
 */
declare function reduceColors(image: ImageDataLike, options?: QuantizeOptions): Uint8Array;
```

# Performance

Decode & Encode `test/snapshot/image.*` files, `time.SD` is Standard Deviation of the time.

This benchmark ignores extra code size introduced by icodec, which in practice needs to be taken into account.

Decode on Edge browser.

| No. |   Name | codec |        time |      time.SD |
|----:|-------:|------:|------------:|-------------:|
|   0 | icodec |  avif |     3.22 ms |      8.24 us |
|   1 |     2d |  avif |     1.50 ms |      3.13 us |
|   2 |  WebGL |  avif |     3.08 ms |     26.33 us |
|   3 | icodec |  heic |     3.06 ms |     16.84 us |
|   4 | icodec |  jpeg |   727.85 us |      1.65 us |
|   5 |     2d |  jpeg |   601.21 us |      3.51 us |
|   6 |  WebGL |  jpeg | 1,876.96 us |      8.85 us |
|   7 | icodec |   jxl |     3.57 ms |     17.73 us |
|   8 | icodec |   png |   419.48 us |  2,901.49 ns |
|   9 |     2d |   png |   573.07 us |    801.34 ns |
|  10 |  WebGL |   png | 1,835.78 us | 16,278.04 ns |
|  11 | icodec |   qoi |   444.00 us |      1.08 us |
|  12 | icodec |  webp |   792.57 us |      1.58 us |
|  13 |     2d |  webp |   805.07 us |      4.04 us |
|  14 |  WebGL |  webp | 2,156.43 us |     36.42 us |
|  15 | icodec |   wp2 |     2.59 ms |     12.10 us |

Decode on Node, vs [Sharp](https://github.com/lovell/sharp).

| No. |   Name | codec |        time |  time.SD |
|----:|-------:|------:|------------:|---------:|
|   0 | icodec |  avif |     2.95 ms |  6.46 us |
|   1 |  Sharp |  avif |     2.54 ms |  7.16 us |
|   2 | icodec |  jpeg |   471.99 us |  2.99 us |
|   3 |  Sharp |  jpeg |   842.17 us |  1.50 us |
|   4 | icodec |   jxl |     3.03 ms |  7.62 us |
|   5 | icodec |   png |   186.18 us |  1.94 us |
|   6 |  Sharp |   png |   645.95 us |  1.78 us |
|   7 | icodec |   qoi |   200.62 us |  1.41 us |
|   8 | icodec |  webp |   557.32 us |  2.92 us |
|   9 |  Sharp |  webp | 1,708.96 us | 12.14 us |
|  10 | icodec |   wp2 |     2.27 ms |  1.99 us |

Encode on Node, vs [Sharp](https://github.com/lovell/sharp). Note that icodec and Sharp do not use the same code, so the output images are not exactly equal.

| No. |   Name | codec |        time |   time.SD |
|----:|-------:|------:|------------:|----------:|
|   0 | icodec |  avif |     2.97 ms |   9.51 us |
|   1 |  Sharp |  avif |     2.61 ms |   8.28 us |
|   2 | icodec |  jpeg |   479.30 us |   2.10 us |
|   3 |  Sharp |  jpeg |   894.27 us |   2.11 us |
|   4 | icodec |   jxl |     3.18 ms | 114.32 us |
|   5 | icodec |   png |   189.39 us |   1.36 us |
|   6 |  Sharp |   png |   689.49 us |   2.36 us |
|   7 | icodec |   qoi |   204.42 us |   1.26 us |
|   8 | icodec |  webp |   555.51 us |   1.59 us |
|   9 |  Sharp |  webp | 1,773.42 us |  10.45 us |
|  10 | icodec |   wp2 |     2.34 ms |  50.14 us |

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
node scripts/build.js
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
node scripts/start-demo.js
```
