import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { extname } from "node:path";

/*
 * To unlock SharedArrayBuffer we have to create a custom server and add 2 headers.
 * This is really annoying, I haven't found any way to remove this restriction of browser.
 */

const moduleMime = {
	wasm: "application/wasm",
	heml: "text/html",
	css: "text/css",
	js: "text/javascript",
	json: "application/json",
};

const server = createServer((request, response) => {
	const path = "." + request.url.split("?", 2)[0];
	const stream = createReadStream(path);

	const headers = {
		"Cross-Origin-Embedder-Policy": "require-corp",
		"Cross-Origin-Opener-Policy": "same-origin",
	};

	stream.on("open", () => {
		const mime = moduleMime[extname(path).slice(1)];
		if (mime) {
			headers["Content-Type"] = mime;
		}
		stream.pipe(response.writeHead(200, headers));
	});
	stream.on("error", () => response.writeHead(404).end());
});

server.listen(80, () => console.log("Demo hosted at http://localhost/demo.html"));