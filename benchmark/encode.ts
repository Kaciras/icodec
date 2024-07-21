import { defineSuite } from "esbench";
import { encode, initialize } from "../lib/png.ts";
import { readFileSync } from "fs";
import sharp from "sharp";

const rawBuffer = readFileSync("test/image.bin");
await initialize();
const si = sharp(rawBuffer, { raw: { width: 417, height: 114, channels: 4 } });

export default defineSuite(scene => {
	scene.bench("WASM", () => encode(rawBuffer, 417, 114, {}));
	scene.benchAsync("Sharp", () => si.png({ quality: 75, palette: true }).toBuffer());
});
