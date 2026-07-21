#!/usr/bin/env node
// Writes a QR code PNG for a public Expo tunnel URL (exp://<id>.exp.direct) to
// the user's desktop, so it can be sent to a tester on a different network /
// country who scans it in Expo Go over cellular. Unlike write-dev-qr.mjs (which
// encodes the LAN IP and only works on the same Wi-Fi), the tunnel URL is
// reachable off-LAN. Pass the exp.direct URL that `expo start --tunnel` prints.
//
// Usage: node scripts/write-tunnel-qr.mjs exp://<id>-anonymous-8081.exp.direct
// The tunnel URL changes every session, so rerun this whenever you restart the
// tunnel and resend the fresh PNG.

import os from "node:os";
import path from "node:path";
import QRCode from "qrcode";

const OUTPUT = path.join(os.homedir(), "Desktop", "florish-tunnel-qr.png");

async function main() {
  const url = process.argv[2];
  if (!url || !/^exp:\/\//.test(url)) {
    console.error(
      "[tunnel-qr] Pass the exp:// tunnel URL as the first argument, e.g.\n" +
        "  node scripts/write-tunnel-qr.mjs exp://abc123-anonymous-8081.exp.direct",
    );
    process.exit(1);
  }
  if (!/exp\.direct/.test(url)) {
    console.warn(
      "[tunnel-qr] Warning: that URL is not an *.exp.direct tunnel URL, so it " +
        "likely won't work off-LAN. Continuing anyway.",
    );
  }

  await QRCode.toFile(OUTPUT, url, { width: 512, margin: 2 });
  console.log(`[tunnel-qr] ${url}`);
  console.log(`[tunnel-qr] QR code saved to ${OUTPUT} - send this image; scan it in Expo Go.`);
}

main().catch((error) => {
  console.error("[tunnel-qr] Failed to write QR code:", error);
  process.exit(1);
});
