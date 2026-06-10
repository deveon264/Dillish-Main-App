#!/usr/bin/env node
// Seeds the prerequisites the on-device workout-video E2E flow
// (.maestro/workout-video-advance.yaml) needs against a target server:
//
//   1. A QA account that EXISTS on the server and has finished onboarding, so
//      subflows/login.yaml signs in and lands on the app (not the onboarding
//      flow). Created via /api/signup, then marked onboarding-complete via
//      /api/me. Re-runs are safe: an existing account is reused.
//   2. A SHORT demo clip on the FIRST exercise of a known workout (default
//      `reformer-pilates`, first exercise `e1`), so the flow's "play to end"
//      step finishes in seconds. Uploaded via the admin-gated /api/exercises
//      route (workoutId + exerciseId) so the workout player maps it to that
//      exercise. Re-runs are safe: the upload is skipped when a clip already
//      exists for that exercise.
//
// This is a standalone Node script (NOT an Expo Router route, NOT bundled by
// Metro). It talks to the running app over HTTP exactly like a client would, so
// it works against the dev server or a deployed app without reaching into the
// DB or object storage directly.
//
// Auth: the exercise upload is admin-gated. Rather than introducing a new
// machine secret, this mints the very same HMAC-signed admin Bearer token the
// route already verifies, using the server-only SESSION_SECRET. The
// token-minting below is a deliberate 1:1 reimplementation of mintAdminToken in
// lib/adminAuth.ts in plain node:crypto (matches scripts/cleanup-cron.mjs). If
// you change the signing scheme (SIGN_INFO, payload shape, TTL) in
// lib/adminAuth.ts, update this file (and cleanup-cron.mjs) in lockstep or the
// token will be rejected.
//
// Required env:
//   SESSION_SECRET   - already configured; used to sign the admin token.
// Optional env:
//   SEED_APP_URL     - base URL of the target app (e.g. https://your-app.replit.app).
//                      Falls back to REPLIT_DEV_DOMAIN in development.
//   MAESTRO_EMAIL     - QA account email     (default qa@florish.fit)
//   MAESTRO_PASSWORD  - QA account password  (default FlorishQA123!)
//   MAESTRO_WORKOUT_ID- workout to seed      (default reformer-pilates)
//   SEED_EXERCISE_ID  - first exercise id    (default e1; matches constants/workouts.ts)
//   SEED_QA_NAME      - QA account name       (default QA Tester)
//   SEED_CLIP_PATH    - path to the demo clip (default .maestro/assets/qa-clip.mp4)
//   ADMIN_EMAIL       - overrides the built-in admin identity (keep in sync with
//                       constants/admin.ts; defaults to that value).

import crypto from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const SIGN_INFO = "florish-admin-session-v1";
const TOKEN_TTL_SEC = 60 * 60 * 12; // 12 hours, matches scripts/cleanup-cron.mjs
const DEFAULT_ADMIN_EMAIL = "6ixbelowna@gmail.com"; // keep in sync with constants/admin.ts

const ROOT = path.resolve(fileURLToPath(import.meta.url), "../..");

function b64url(buf) {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function mintAdminToken(sessionSecret, adminEmail) {
  // Derive a dedicated signing key from SESSION_SECRET (never sign with the raw
  // secret) — mirrors signingKey() in lib/adminAuth.ts.
  const derived = crypto.createHmac("sha256", sessionSecret).update(SIGN_INFO).digest();
  const expiresAt = Date.now() + TOKEN_TTL_SEC * 1000;
  const payload = b64url(
    Buffer.from(
      JSON.stringify({ role: "admin", email: adminEmail, exp: expiresAt }),
      "utf8"
    )
  );
  const sig = b64url(crypto.createHmac("sha256", derived).update(payload).digest());
  return `${payload}.${sig}`;
}

function resolveBaseUrl() {
  const explicit = process.env.SEED_APP_URL;
  if (explicit) return explicit.startsWith("http") ? explicit : `https://${explicit}`;
  const dev = process.env.REPLIT_DEV_DOMAIN;
  if (dev) return dev.startsWith("http") ? dev : `https://${dev}`;
  return null;
}

function log(...args) {
  console.log(`[seed-e2e ${new Date().toISOString()}]`, ...args);
}

function fail(msg) {
  console.error(`[seed-e2e] ${msg}`);
  process.exit(1);
}

// Creates the QA account if it does not exist, then signs in and returns a
// member session token. A 409 from signup means the account already exists,
// which is the expected path on every re-run.
async function ensureQaUser(root, { name, email, password }) {
  const signup = await fetch(`${root}/api/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, password }),
  });
  if (signup.ok) {
    log(`Created QA account ${email}.`);
  } else if (signup.status === 409) {
    log(`QA account ${email} already exists; reusing it.`);
  } else {
    const body = await signup.text().catch(() => "");
    fail(`signup failed (${signup.status}): ${body.slice(0, 300)}`);
  }

  const login = await fetch(`${root}/api/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!login.ok) {
    const body = await login.text().catch(() => "");
    fail(
      `login failed (${login.status}): ${body.slice(0, 300)}. ` +
        `If the account exists with a different password, delete it or set MAESTRO_PASSWORD to match.`
    );
  }
  const { token } = await login.json();
  if (!token) fail("login returned no token.");
  return token;
}

// Marks the QA account onboarding-complete so the app router does not bounce the
// E2E session into the onboarding flow. Idempotent: setting it again is a no-op.
async function completeOnboarding(root, sessionToken) {
  const res = await fetch(`${root}/api/me`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${sessionToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ onboardingComplete: true }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    fail(`could not mark onboarding complete (${res.status}): ${body.slice(0, 300)}`);
  }
  log("QA account onboarding marked complete.");
}

// Uploads the demo clip to the workout's first exercise unless one is already
// there. The clip is sent as the raw request body with metadata in query params,
// exactly like the in-app upload (lib/exercises.ts).
async function ensureWorkoutClip(root, adminToken, { workoutId, exerciseId, clipPath }) {
  const existing = await fetch(
    `${root}/api/exercises?workoutId=${encodeURIComponent(workoutId)}&exerciseId=${encodeURIComponent(
      exerciseId
    )}`
  );
  if (existing.ok) {
    const data = await existing.json().catch(() => ({}));
    if (Array.isArray(data.items) && data.items.length > 0) {
      log(
        `Clip already present for ${workoutId}/${exerciseId} (${data.items.length}); skipping upload.`
      );
      return;
    }
  } else {
    const body = await existing.text().catch(() => "");
    fail(`could not check existing clips (${existing.status}): ${body.slice(0, 300)}`);
  }

  let bytes;
  try {
    bytes = await readFile(clipPath);
  } catch (e) {
    fail(`could not read demo clip at ${clipPath}: ${e?.message ?? e}`);
  }

  const qs = new URLSearchParams({
    title: "QA Demo Clip",
    description: "Short clip seeded for the on-device E2E flow.",
    cues: "",
    category: "Pilates",
    level: "Intermediate",
    duration: "0:03",
    filename: "qa-clip.mp4",
    workoutId,
    exerciseId,
  }).toString();

  const res = await fetch(`${root}/api/exercises?${qs}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${adminToken}`,
      "Content-Type": "video/mp4",
      "Content-Length": String(bytes.length),
    },
    body: bytes,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    fail(`clip upload failed (${res.status}): ${body.slice(0, 300)}`);
  }
  const { item } = await res.json().catch(() => ({}));
  log(
    `Uploaded demo clip (${bytes.length} bytes) to ${workoutId}/${exerciseId}` +
      (item?.id ? ` as exercise ${item.id}.` : ".")
  );
}

async function main() {
  const sessionSecret = process.env.SESSION_SECRET;
  if (!sessionSecret) fail("SESSION_SECRET is not set — cannot authenticate the upload.");

  const base = resolveBaseUrl();
  if (!base) {
    fail("No target URL. Set SEED_APP_URL to the app's base URL (or run with REPLIT_DEV_DOMAIN set).");
  }
  const root = base.replace(/\/$/, "");

  const email = (process.env.MAESTRO_EMAIL || "qa@florish.fit").trim().toLowerCase();
  const password = process.env.MAESTRO_PASSWORD || "FlorishQA123!";
  const name = process.env.SEED_QA_NAME || "QA Tester";
  const workoutId = (process.env.MAESTRO_WORKOUT_ID || "reformer-pilates").trim();
  const exerciseId = (process.env.SEED_EXERCISE_ID || "e1").trim();
  const clipPath = process.env.SEED_CLIP_PATH || path.join(ROOT, ".maestro/assets/qa-clip.mp4");
  const adminEmail = (process.env.ADMIN_EMAIL || DEFAULT_ADMIN_EMAIL).trim();

  log(`Seeding ${root} (workout=${workoutId}, exercise=${exerciseId}, qa=${email}).`);

  const sessionToken = await ensureQaUser(root, { name, email, password });
  await completeOnboarding(root, sessionToken);

  const adminToken = mintAdminToken(sessionSecret, adminEmail);
  await ensureWorkoutClip(root, adminToken, { workoutId, exerciseId, clipPath });

  log("Done. The QA account and demo clip are ready for the E2E flow.");
}

main().catch((err) => {
  console.error("[seed-e2e] Unexpected error:", err?.message ?? err);
  process.exit(1);
});
