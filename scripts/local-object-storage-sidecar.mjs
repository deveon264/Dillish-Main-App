// Local stand-in for Replit's Object Storage sidecar (normally at
// http://127.0.0.1:1106), used only for local dev outside Replit. Implements
// just enough of the sidecar's contract for lib/objectStorageServer.ts to
// upload/serve/delete files, backed by the local filesystem instead of GCS.
//
// Does NOT implement real GCS listing (storage.googleapis.com), so the
// admin cleanup sweeps (exercise-cleanup, meal-photo-cleanup, etc.) will
// still fail locally. Upload and playback (the core exercise-video flow)
// work fully.
import http from "node:http";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import os from "node:os";

const PORT = 1106;
const STORAGE_ROOT = path.join(process.cwd(), ".local-object-storage");

// The URL we return from signed-object-url is followed by the *client*
// (the phone), not this server process, so it must resolve to this PC's
// real LAN address rather than 127.0.0.1 (which means "the phone itself" to
// the phone). Detected fresh on every call so it self-heals if the PC's IP
// changes between DHCP leases.
function lanHost() {
  for (const ifaces of Object.values(os.networkInterfaces())) {
    for (const iface of ifaces ?? []) {
      if (iface.family === "IPv4" && !iface.internal) return iface.address;
    }
  }
  return "127.0.0.1";
}

function safeJoin(bucket, object) {
  const resolved = path.resolve(STORAGE_ROOT, bucket, object);
  if (!resolved.startsWith(path.resolve(STORAGE_ROOT))) {
    throw new Error("Invalid path");
  }
  return resolved;
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
    console.log(`${req.method} ${url.pathname}`);

    if (req.method === "POST" && url.pathname === "/object-storage/signed-object-url") {
      const body = await readJsonBody(req);
      const signed = new URL(`http://${lanHost()}:${PORT}/local-object`);
      signed.searchParams.set("b", body.bucket_name);
      signed.searchParams.set("o", body.object_name);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ signed_url: signed.toString() }));
      return;
    }

    if (req.method === "POST" && url.pathname === "/token") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ access_token: "local-dev-fake-token" }));
      return;
    }

    if (url.pathname === "/local-object") {
      const bucket = url.searchParams.get("b") ?? "";
      const object = url.searchParams.get("o") ?? "";
      if (!bucket || !object) {
        res.writeHead(400).end("Missing bucket/object");
        return;
      }
      const filePath = safeJoin(bucket, object);
      const metaPath = filePath + ".meta.json";

      if (req.method === "PUT") {
        await fsp.mkdir(path.dirname(filePath), { recursive: true });
        const contentType = req.headers["content-type"] || "application/octet-stream";
        await fsp.writeFile(metaPath, JSON.stringify({ contentType }));
        const writeStream = fs.createWriteStream(filePath);
        req.pipe(writeStream);
        writeStream.on("finish", () => res.writeHead(200).end());
        writeStream.on("error", (err) => {
          console.error("write error:", err);
          res.writeHead(500).end();
        });
        return;
      }

      if (req.method === "GET" || req.method === "HEAD") {
        let stat;
        try {
          stat = await fsp.stat(filePath);
        } catch {
          res.writeHead(404).end("Not found");
          return;
        }
        let contentType = "application/octet-stream";
        try {
          contentType = JSON.parse(await fsp.readFile(metaPath, "utf8")).contentType;
        } catch {}

        const range = req.headers.range;
        if (range) {
          const match = /bytes=(\d*)-(\d*)/.exec(range);
          const start = match[1] ? parseInt(match[1], 10) : 0;
          const end = match[2] ? parseInt(match[2], 10) : stat.size - 1;
          res.writeHead(206, {
            "Content-Type": contentType,
            "Content-Length": end - start + 1,
            "Content-Range": `bytes ${start}-${end}/${stat.size}`,
            "Accept-Ranges": "bytes",
          });
          if (req.method === "HEAD") return res.end();
          fs.createReadStream(filePath, { start, end }).pipe(res);
          return;
        }

        res.writeHead(200, {
          "Content-Type": contentType,
          "Content-Length": stat.size,
          "Accept-Ranges": "bytes",
        });
        if (req.method === "HEAD") return res.end();
        fs.createReadStream(filePath).pipe(res);
        return;
      }

      if (req.method === "DELETE") {
        try {
          await fsp.unlink(filePath);
          await fsp.unlink(metaPath).catch(() => {});
          res.writeHead(200).end();
        } catch {
          res.writeHead(404).end();
        }
        return;
      }
    }

    res.writeHead(404).end("Not found");
  } catch (err) {
    console.error("sidecar error:", err);
    res.writeHead(500).end("Internal error");
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Local object-storage sidecar listening on 0.0.0.0:${PORT}`);
  console.log(`Detected LAN address for client-facing URLs: ${lanHost()}`);
  console.log(`Storing files under ${STORAGE_ROOT}`);
});
