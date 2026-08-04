const http = require("http");
const fs = require("fs");
const path = require("path");

const root = __dirname;
const port = 8765;
const host = "127.0.0.1";
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".csv": "text/csv; charset=utf-8",
  ".md": "text/markdown; charset=utf-8"
};

http.createServer((req, res) => {
  try {
    const url = new URL(req.url, `http://${host}:${port}`);
    let pathname = decodeURIComponent(url.pathname);
    if (pathname === "/") pathname = "/index.html";

    const requested = pathname.replace(/\\/g, "/").replace(/^\/+/, "");
    const file = path.resolve(root, requested);
    if (!file.startsWith(root)) {
      res.writeHead(403, { "content-type": "text/plain; charset=utf-8" });
      res.end("Forbidden");
      return;
    }

    fs.readFile(file, (err, data) => {
      if (err) {
        res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
        res.end("Not found");
        return;
      }
      res.writeHead(200, { "content-type": types[path.extname(file).toLowerCase()] || "application/octet-stream" });
      res.end(data);
    });
  } catch (error) {
    res.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
    res.end(String(error && error.stack || error));
  }
}).listen(port, host, () => {
  console.log(`Serving ${root} at http://${host}:${port}/`);
});
