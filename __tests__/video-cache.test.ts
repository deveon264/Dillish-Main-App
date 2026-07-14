import { test } from "node:test";
import assert from "node:assert/strict";

import { clipFileName, resolveClipSource, type VideoCacheFs } from "@/lib/videoCache";

// In-memory fake of the expo-file-system surface the cache uses. Downloads are
// awaited through a controllable promise so the "background" fill can be
// observed deterministically.

function fakeFs(initialFiles: string[] = []) {
  const files = new Set(initialFiles);
  const calls = { downloads: [] as Array<{ url: string; to: string }>, removed: [] as string[] };
  let failDownload = false;
  const fs: VideoCacheFs = {
    cacheDir: "file:///cache/",
    exists: async (uri) => files.has(uri),
    makeDir: async () => {},
    download: async (url, to) => {
      calls.downloads.push({ url, to });
      if (failDownload) throw new Error("network down");
      files.add(to);
    },
    move: async (from, to) => {
      if (!files.has(from)) throw new Error("missing tmp");
      files.delete(from);
      files.add(to);
    },
    remove: async (uri) => {
      files.delete(uri);
      calls.removed.push(uri);
    },
    list: async (dir) =>
      [...files].filter((f) => f.startsWith(dir)).map((f) => f.slice(dir.length)),
  };
  return { fs, files, calls, setFailDownload: (v: boolean) => (failDownload = v) };
}

const DIR = "file:///cache/exercise-videos/";
const REMOTE = "https://host/api/exercise-video?id=vid-1";

// Wait for the background download kicked off by resolveClipSource to settle.
const settle = () => new Promise((r) => setTimeout(r, 0));

test("clipFileName keys by id and size, sanitized", () => {
  assert.equal(clipFileName("vid-1", 12345), "vid-1-12345.mp4");
  assert.equal(clipFileName("../evil/id", 7), "___evil_id-7.mp4");
  assert.equal(clipFileName("vid-1", NaN), "vid-1-0.mp4");
});

test("cache hit returns the local file URI without downloading", async () => {
  const { fs, calls } = fakeFs([`${DIR}vid-1-100.mp4`]);
  const src = await resolveClipSource(fs, "vid-1", 100, REMOTE);
  assert.equal(src, `${DIR}vid-1-100.mp4`);
  assert.equal(calls.downloads.length, 0);
});

test("cache miss streams the remote URL and fills the cache in the background (tmp then move)", async () => {
  const { fs, files, calls } = fakeFs();
  const src = await resolveClipSource(fs, "vid-2", 200, REMOTE);
  assert.equal(src, REMOTE); // playback starts remotely right away
  await settle();
  assert.deepEqual(calls.downloads, [{ url: REMOTE, to: `${DIR}vid-2-200.mp4.tmp` }]);
  assert.ok(files.has(`${DIR}vid-2-200.mp4`)); // moved into place
  assert.ok(!files.has(`${DIR}vid-2-200.mp4.tmp`));

  // Next watch is a hit.
  assert.equal(await resolveClipSource(fs, "vid-2", 200, REMOTE), `${DIR}vid-2-200.mp4`);
});

test("a replaced clip (new size) re-downloads and evicts the old variant", async () => {
  const { fs, files } = fakeFs([`${DIR}vid-3-100.mp4`]);
  const src = await resolveClipSource(fs, "vid-3", 999, REMOTE);
  assert.equal(src, REMOTE);
  await settle();
  assert.ok(files.has(`${DIR}vid-3-999.mp4`));
  assert.ok(!files.has(`${DIR}vid-3-100.mp4`)); // old variant evicted
});

test("a failed download leaves no file (tmp cleaned) and a later call retries", async () => {
  const { fs, files, calls, setFailDownload } = fakeFs();
  setFailDownload(true);
  assert.equal(await resolveClipSource(fs, "vid-4", 50, REMOTE), REMOTE);
  await settle();
  assert.equal(files.size, 0);

  setFailDownload(false);
  assert.equal(await resolveClipSource(fs, "vid-4", 50, REMOTE), REMOTE);
  await settle();
  assert.ok(files.has(`${DIR}vid-4-50.mp4`));
  assert.equal(calls.downloads.length, 2);
});

test("no cache directory (web) is a pure passthrough", async () => {
  const { fs, calls } = fakeFs();
  (fs as { cacheDir: string | null }).cacheDir = null;
  assert.equal(await resolveClipSource(fs, "vid-5", 10, REMOTE), REMOTE);
  await settle();
  assert.equal(calls.downloads.length, 0);
});

test("concurrent misses for the same clip trigger exactly one download", async () => {
  const { fs, calls } = fakeFs();
  const [a, b] = await Promise.all([
    resolveClipSource(fs, "vid-6", 60, REMOTE),
    resolveClipSource(fs, "vid-6", 60, REMOTE),
  ]);
  assert.equal(a, REMOTE);
  assert.equal(b, REMOTE);
  await settle();
  assert.equal(calls.downloads.length, 1);
});
