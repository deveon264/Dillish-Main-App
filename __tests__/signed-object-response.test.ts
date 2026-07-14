import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";

import { signedObjectResponse } from "@/lib/objectStorageServer";

// signedObjectResponse decides how media reaches the phone: signed URLs on
// public hosts (GCS) keep the historical 302 redirect, while private/LAN hosts
// (the local dev sidecar) are proxied through the API server so clients off
// this network (Expo tunnel mode) can still fetch the bytes.

const SIZE = 4096;
const FIXTURE = Buffer.alloc(SIZE);
for (let i = 0; i < SIZE; i++) FIXTURE[i] = (i * 31 + 7) & 0xff;

let server: http.Server;
let origin = "";

before(async () => {
  // Minimal stand-in for the sidecar's /local-object handler: byte fixture
  // with Range/206 support at /object, 404 elsewhere.
  server = http.createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    if (url.pathname !== "/object") {
      res.writeHead(404).end("Not found");
      return;
    }
    const range = req.headers.range;
    if (range) {
      const match = /bytes=(\d*)-(\d*)/.exec(range);
      const start = match?.[1] ? parseInt(match[1], 10) : 0;
      const end = match?.[2] ? parseInt(match[2], 10) : SIZE - 1;
      res.writeHead(206, {
        "Content-Type": "video/mp4",
        "Content-Length": end - start + 1,
        "Content-Range": `bytes ${start}-${end}/${SIZE}`,
        "Accept-Ranges": "bytes",
      });
      res.end(FIXTURE.subarray(start, end + 1));
      return;
    }
    res.writeHead(200, {
      "Content-Type": "video/mp4",
      "Content-Length": SIZE,
      "Accept-Ranges": "bytes",
    });
    res.end(FIXTURE);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(() => {
  server.close();
});

function req(headers: Record<string, string> = {}): Request {
  return new Request("http://t/api/media?id=x", { headers });
}

// --- public hosts: redirect ------------------------------------------------

test("a public https signed URL redirects (302) with the exact Location", async () => {
  const res = await signedObjectResponse("https://signed.example/bucket/obj?sig=abc", req());
  assert.equal(res.status, 302);
  assert.equal(res.headers.get("Location"), "https://signed.example/bucket/obj?sig=abc");
  assert.equal(res.headers.get("Cache-Control"), "no-store");
});

test("the redirect carries the caller's cache-control", async () => {
  const res = await signedObjectResponse("https://signed.example/x", req(), "private, max-age=600");
  assert.equal(res.status, 302);
  assert.equal(res.headers.get("Cache-Control"), "private, max-age=600");
});

// --- private/LAN hosts: proxy ------------------------------------------------

test("a LAN signed URL is proxied: full body with passthrough headers", async () => {
  const res = await signedObjectResponse(`${origin}/object`, req());
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("Location"), null);
  assert.equal(res.headers.get("Content-Type"), "video/mp4");
  assert.equal(res.headers.get("Content-Length"), String(SIZE));
  assert.equal(res.headers.get("Accept-Ranges"), "bytes");
  const body = Buffer.from(await res.arrayBuffer());
  assert.equal(body.length, SIZE);
  assert.deepEqual(body, FIXTURE);
});

test("a Range request is forwarded and the 206 slice passes through byte-for-byte", async () => {
  const res = await signedObjectResponse(`${origin}/object`, req({ Range: "bytes=100-199" }));
  assert.equal(res.status, 206);
  assert.equal(res.headers.get("Content-Range"), `bytes 100-199/${SIZE}`);
  assert.equal(res.headers.get("Content-Length"), "100");
  const body = Buffer.from(await res.arrayBuffer());
  assert.deepEqual(body, FIXTURE.subarray(100, 200));
});

test("an upstream 404 passes through as 404", async () => {
  const res = await signedObjectResponse(`${origin}/missing`, req());
  assert.equal(res.status, 404);
});

test("RFC 1918 hosts are treated as private, public IPs are not", async () => {
  // 203.0.113.9 (TEST-NET-3) is public → redirect, no fetch attempted.
  const pub = await signedObjectResponse("http://203.0.113.9:1106/local-object?b=x&o=y", req());
  assert.equal(pub.status, 302);
  // 192.168.x.x is private → proxy path (unreachable here, so fetch rejects).
  await assert.rejects(
    signedObjectResponse("http://192.168.255.254:1/none", req()),
    /fetch failed/i
  );
});
