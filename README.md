# icodec

Image encoders & decoders with WebAssembly.

Supported codecs:

<table>
    <thead>
        <tr>
            <th>Module</th>
            <th>Encoder</th>
            <th>Decoder</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>jpeg</td>
            <td>MozJPEG</td>
            <td>❌</td>
        </tr>
        <tr>
            <td>png</td>
            <td>OxiPNG + imagequant</td>
            <td>❌</td>
        </tr>
        <tr>
            <td>qoi</td>
            <td colspan='2'>qoi</td>
        </tr>
        <tr>
            <td>webp</td>
            <td colspan='2'>libwebp</td>
        </tr>
        <tr>
            <td>avif</td>
            <td colspan='2'>libavif, aom</td>
        </tr>
        <tr>
            <td>jxl</td>
            <td colspan='2'>libjxl</td>
        </tr>
        <tr>
            <td>wp2</td>
            <td colspan='2'>libwebp2</td>
        </tr>
    </tbody>
</table>

# Usage

```shell
pnpm add icodec
```

Use in browser:

```javascript
// All codec modules (see the table above) are named export.
import { avif, jxl } from "icodec";

const response = await fetch("https://raw.githubusercontent.com/Kaciras/icodec/master/test/snapshot/image.avif")

// This should be called once before you invoke `encode()`
await avif.loadDecoder();

// Decode AVIF to ImageData.
const image = avif.decode(await response.arrayBuffer());

// Encode the image to JPEG XL, also need to load the encoder WASM first.
await jxl.loadEncoder();
const encoded = jxl.encode(image.data, image.width, image.height);
```

Each codec module exports:

- `loadEncoder(input?)`: Load the encoder WASM file, must be called once before `encode`, it accepts an optional argument:
  - If pass a string, it's the URL of WASM file to fetch.
  - If pass a `ArrayBuffer` or `ArrayBufferView`, it will be treated as the WASM bytes.

  This function returns the underlying WASM module, which is not part of the public API and can be changed at any time.

- `encode(buffer, width, height, options?)`: Encode the RGBA buffer.
- `mimeType`: The MIME type string of the codec.
- `extension`: File extension of the format.
- `defaultOptions`: The default options for `encode` function.
- `type Options`: Type definition of the encode options.

If the module support decoding, it will also export: 

- `loadDecoder(input?)`: Like `loadEncoder`, but for `decode`.
- `decode(buffer)`: Convert the image to RGBA data, the return value is an `ImageData` type.

The `png` module export extra members:

- `reduceColors(buffer, width, height, options?)`: Reduces the colors used in the image at a slight loss, returns `Uint8Array`.
- `type QuantizeOptions`: Type definition of the options in `reduceColors`.

To use icodec in Node, just change the import specifier to `icodec/node`, and `loadEncoder`/`loadDecoder` will use `readFileSync` instead of `fetch` for file reading.

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

# Build

To build WASM modules, you will need to install:

* [Cmake](https://cmake.org) >= 3.24
* [Rust](https://www.rust-lang.org/tools/install) & [wasm-pack](https://rustwasm.github.io/wasm-pack/installer)
* [Emscripten](https://emscripten.org/docs/getting_started/downloads.html)
* A proper C/C++ compiler toolchain, depending on your operating system

Run the build script:

```shell
node build.js
```

