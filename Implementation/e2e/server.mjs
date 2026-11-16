import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { dirname, extname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8"
};

createServer(async (request, response) => {
  const url = new URL(request.url, "http://127.0.0.1");
  const relative = decodeURIComponent(url.pathname);
  const path = resolve(join(root, "." + relative));
  if (!path.startsWith(root + sep) && path !== root) {
    response.writeHead(403);
    response.end();
    return;
  }
  try {
    const candidate = (await stat(path)).isDirectory() ?
      join(path, "index.html") : path;
    const content = await readFile(candidate);
    response.writeHead(200, {
      "Content-Type": mime[extname(candidate)] ?? "application/octet-stream"
    });
    response.end(content);
  } catch {
    response.writeHead(404);
    response.end();
  }
}).listen(4173, "127.0.0.1");
