// Walkthrough -> MP4 recorder (real-time CDP screencast).
//
// Plays the looping reel once in real time and collects compositor frames via
// Page.startScreencast (fast: ~1 loop of wall-clock time, not thousands of
// sequential screenshots). Frames are saved with their capture timestamps, then
// ffmpeg resamples them to a constant 30fps clip of exactly one loop.
//
// Usage:
//   CHROMIUM_BIN=/path/to/chromium node record.cjs <htmlPath> <outMp4> [loops]
// htmlPath is relative to this tooling dir (e.g. ../walkthrough-dillish/index.html)

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const puppeteer = require("puppeteer");

const HTML = "file://" + path.resolve(__dirname, process.argv[2] || "../walkthrough-dillish/index.html");
const OUT = path.resolve(__dirname, process.argv[3] || "../walkthrough.mp4");
const LOOPS = Math.max(1, parseInt(process.argv[4] || "1", 10));
const CHROMIUM = process.env.CHROMIUM_BIN;

const FPS = 30;
const STAGE_W = 720;
const STAGE_H = 1280;
const SCALE = 1.5; // native capture 1080x1920
const OUT_W = 1080;
const OUT_H = 1920;
const LOOP_MS = 35000; // one full loop (DUR array sums to 35000)

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "reel-"));
  const browser = await puppeteer.launch({
    executablePath: CHROMIUM,
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--force-color-profile=srgb"],
  });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: STAGE_W, height: STAGE_H, deviceScaleFactor: SCALE });
    await page.goto(HTML, { waitUntil: "load", timeout: 60000 });
    await page.evaluate(() => (document.fonts ? document.fonts.ready : null));
    await sleep(300); // settle fonts/layout before capture

    const session = await page.createCDPSession();
    const frames = []; // { t: seconds, file }
    let n = 0;
    session.on("Page.screencastFrame", async (evt) => {
      const file = path.join(dir, "f" + String(n++).padStart(6, "0") + ".jpg");
      fs.writeFileSync(file, Buffer.from(evt.data, "base64"));
      frames.push({ t: evt.metadata.timestamp, file });
      try {
        await session.send("Page.screencastFrameAck", { sessionId: evt.sessionId });
      } catch (_) {}
      if (n % 60 === 0) console.log("captured " + n + " frames");
    });

    const captureMs = LOOP_MS * LOOPS + 1200; // small tail so resample fills the end
    await session.send("Page.startScreencast", {
      format: "jpeg",
      quality: 92,
      maxWidth: OUT_W,
      maxHeight: OUT_H,
      everyNthFrame: 1,
    });
    await sleep(captureMs);
    await session.send("Page.stopScreencast");
    await sleep(150);

    if (frames.length < 10) throw new Error("too few frames captured: " + frames.length);
    console.log("total frames: " + frames.length + " over " + (frames[frames.length - 1].t - frames[0].t).toFixed(2) + "s");

    // Build an ffmpeg concat list with per-frame durations from real timestamps.
    const t0 = frames[0].t;
    let list = "";
    for (let i = 0; i < frames.length; i++) {
      const next = i + 1 < frames.length ? frames[i + 1].t : frames[i].t + 1 / FPS;
      const d = Math.max(1 / 1000, next - frames[i].t);
      list += `file '${frames[i].file}'\nduration ${d.toFixed(4)}\n`;
    }
    // concat demuxer ignores the final duration unless the last file repeats.
    list += `file '${frames[frames.length - 1].file}'\n`;
    const listPath = path.join(dir, "list.txt");
    fs.writeFileSync(listPath, list);

    const outDur = (LOOP_MS * LOOPS) / 1000;
    const args = [
      "-y",
      "-f", "concat", "-safe", "0", "-i", listPath,
      "-t", String(outDur),
      "-vf", `fps=${FPS},scale=${OUT_W}:${OUT_H}:flags=lanczos,format=yuv420p`,
      "-c:v", "libx264", "-crf", "18", "-preset", "medium",
      "-movflags", "+faststart",
      OUT,
    ];
    console.log("encoding -> " + OUT + " (" + outDur + "s)");
    const r = spawnSync("ffmpeg", args, { stdio: ["ignore", "inherit", "inherit"] });
    if (r.status !== 0) throw new Error("ffmpeg exited " + r.status);
    console.log("VIDEO_OK " + OUT);
  } catch (e) {
    console.log("VIDEO_FAIL", e.message);
    process.exitCode = 1;
  } finally {
    await browser.close();
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) {}
  }
})();
