// Local open-source speech-to-text sidecar for voice meal logging, used when
// the OpenAI audio endpoint is unavailable (e.g. per-model quota limits).
// Runs OpenAI's Whisper (base.en) fully locally via Hugging Face
// Transformers.js (ONNX, CPU) - no API key, no quota, audio never leaves this
// machine. /api/transcribe falls back to this server via LOCAL_TRANSCRIBE_URL.
//
// Start with: npm run transcribe-sidecar
// First boot downloads the model (~80MB) into the Hugging Face cache.
import http from "node:http";
import fsp from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { pipeline } from "@huggingface/transformers";
import ffmpegPath from "ffmpeg-static";
import wavefile from "wavefile";

const PORT = 1107;
const MODEL = process.env.LOCAL_WHISPER_MODEL ?? "Xenova/whisper-base.en";
const execFileAsync = promisify(execFile);

console.log(`Loading ${MODEL} (first run downloads the model)...`);
const transcriber = await pipeline("automatic-speech-recognition", MODEL);
console.log("Model ready.");

// Decode any container/codec the app records (m4a on native, webm on web) to
// the 16kHz mono float PCM Whisper expects, using the bundled ffmpeg binary.
async function toPcm(audioB64, format) {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const inPath = path.join(os.tmpdir(), `meal-${stamp}-in.${format}`);
  const outPath = path.join(os.tmpdir(), `meal-${stamp}-16k.wav`);
  try {
    await fsp.writeFile(inPath, Buffer.from(audioB64, "base64"));
    await execFileAsync(ffmpegPath, [
      "-y",
      "-i", inPath,
      "-ar", "16000",
      "-ac", "1",
      "-f", "wav",
      outPath,
    ]);
    const wav = new wavefile.WaveFile(await fsp.readFile(outPath));
    wav.toBitDepth("32f");
    let samples = wav.getSamples();
    if (Array.isArray(samples)) samples = samples[0];
    return Float32Array.from(samples);
  } finally {
    await fsp.rm(inPath, { force: true }).catch(() => {});
    await fsp.rm(outPath, { force: true }).catch(() => {});
  }
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

function sendJson(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
    if (req.method === "GET" && url.pathname === "/health") {
      return sendJson(res, 200, { ok: true, model: MODEL });
    }
    if (req.method === "POST" && url.pathname === "/transcribe") {
      const body = await readJsonBody(req);
      if (!body.audio || typeof body.audio !== "string") {
        return sendJson(res, 400, { error: "Missing audio." });
      }
      const format = ["m4a", "webm", "wav"].includes(body.format) ? body.format : "m4a";
      const started = Date.now();
      const pcm = await toPcm(body.audio, format);
      const out = await transcriber(pcm);
      const text = (out?.text ?? "").trim();
      console.log(`transcribed ${format} in ${Date.now() - started}ms: "${text.slice(0, 80)}"`);
      return sendJson(res, 200, { text });
    }
    sendJson(res, 404, { error: "Not found" });
  } catch (e) {
    console.error("transcribe sidecar error:", e?.message ?? e);
    sendJson(res, 500, { error: "Transcription failed." });
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Local Whisper transcribe sidecar listening on http://127.0.0.1:${PORT}`);
});
