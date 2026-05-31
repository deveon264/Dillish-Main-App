#!/usr/bin/env node
// Scheduled orphan-storage cleanup trigger.
//
// This is a standalone Node script (NOT an Expo Router route, NOT bundled by
// Metro) meant to be run on a recurring schedule — e.g. a Replit Scheduled
// Deployment with the run command `node scripts/cleanup-cron.mjs`. It calls the
// admin-gated `POST /api/exercise-cleanup` endpoint of the deployed web app so
// orphaned exercise-video objects get reclaimed without anyone pressing a button.
//
// Auth: rather than introducing a new machine secret, it mints the very same
// HMAC-signed admin Bearer token the endpoint already verifies, using the
// server-only SESSION_SECRET. The token-minting logic below is a deliberate
// 1:1 reimplementation of `mintAdminToken()` in `lib/adminAuth.ts` in plain
// node:crypto (WebCrypto's importKey/sign there == createHmac here). If you
// ever change the signing scheme (SIGN_INFO, payload shape, TTL) in
// lib/adminAuth.ts, update this file in lockstep or the token will be rejected.
//
// Required env:
//   SESSION_SECRET   - already configured; used to sign the admin token.
//   CLEANUP_APP_URL  - base URL of the deployed app (e.g. https://your-app.replit.app).
//                      In development it falls back to REPLIT_DEV_DOMAIN.
// Optional env:
//   ADMIN_EMAIL      - overrides the built-in admin identity (keep in sync with
//                      constants/admin.ts; defaults to that value).
//   CLEANUP_DRY_RUN  - set to "1" to preview (no deletions).

import crypto from "node:crypto";

const SIGN_INFO = "florish-admin-session-v1";
const TOKEN_TTL_SEC = 60 * 60 * 12; // 12 hours, matches lib/adminAuth.ts
const DEFAULT_ADMIN_EMAIL = "6ixbelowna@gmail.com"; // keep in sync with constants/admin.ts

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
  const derived = crypto
    .createHmac("sha256", sessionSecret)
    .update(SIGN_INFO)
    .digest();
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
  const explicit = process.env.CLEANUP_APP_URL;
  if (explicit) return explicit.startsWith("http") ? explicit : `https://${explicit}`;
  const dev = process.env.REPLIT_DEV_DOMAIN;
  if (dev) return dev.startsWith("http") ? dev : `https://${dev}`;
  return null;
}

function log(...args) {
  console.log(`[cleanup-cron ${new Date().toISOString()}]`, ...args);
}

async function main() {
  const sessionSecret = process.env.SESSION_SECRET;
  if (!sessionSecret) {
    console.error("[cleanup-cron] SESSION_SECRET is not set — cannot authenticate.");
    process.exit(1);
  }

  const base = resolveBaseUrl();
  if (!base) {
    console.error(
      "[cleanup-cron] No target URL. Set CLEANUP_APP_URL to the deployed app's base URL."
    );
    process.exit(1);
  }

  const adminEmail = (process.env.ADMIN_EMAIL || DEFAULT_ADMIN_EMAIL).trim();
  const dryRun = process.env.CLEANUP_DRY_RUN === "1";
  const token = mintAdminToken(sessionSecret, adminEmail);
  const url = `${base.replace(/\/$/, "")}/api/exercise-cleanup${dryRun ? "?dryRun=1" : ""}`;

  log(`Triggering cleanup${dryRun ? " (dry run)" : ""} -> ${url}`);

  let res;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch (err) {
    console.error("[cleanup-cron] Request failed:", err?.message ?? err);
    process.exit(1);
  }

  const body = await res.text();
  if (!res.ok) {
    console.error(`[cleanup-cron] Endpoint returned ${res.status}: ${body.slice(0, 500)}`);
    process.exit(1);
  }

  let summary;
  try {
    summary = JSON.parse(body);
  } catch {
    summary = { raw: body.slice(0, 500) };
  }

  log(
    `Done. scanned=${summary.scanned} referenced=${summary.referenced} ` +
      `orphans=${summary.orphans} deleted=${summary.deleted} failed=${summary.failed}`
  );
  process.exit(0);
}

main().catch((err) => {
  console.error("[cleanup-cron] Unexpected error:", err?.message ?? err);
  process.exit(1);
});
