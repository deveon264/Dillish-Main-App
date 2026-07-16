#!/usr/bin/env node
// Writes a QR code PNG for the current LAN Expo Go URL (exp://<ip>:8081) to
// the user's desktop, so a DHCP IP drift only costs one fresh scan instead of
// hunting for the IP and generating a QR by hand. Called by dev-up.cmd.

import os from "node:os";
import path from "node:path";
import QRCode from "qrcode";

const PORT = 8081;
const OUTPUT = path.join(os.homedir(), "Desktop", "florish-dev-qr.png");
// Right after logon Wi-Fi may still be reconnecting, so retry before giving up.
const RETRY_SECONDS = 60;
const RETRY_INTERVAL_MS = 3000;

function isPrivateIPv4(address) {
  if (address.startsWith("192.168.") || address.startsWith("10.")) return true;
  const match = address.match(/^172\.(\d+)\./);
  return match ? Number(match[1]) >= 16 && Number(match[1]) <= 31 : false;
}

function findLanIPv4() {
  const interfaces = os.networkInterfaces();
  const candidates = [];
  for (const [name, addresses] of Object.entries(interfaces)) {
    for (const info of addresses ?? []) {
      if (info.family !== "IPv4" || info.internal) continue;
      if (!isPrivateIPv4(info.address)) continue;
      // Skip virtual adapters (Hyper-V, WSL, VPN) that phones cannot reach.
      if (/vEthernet|WSL|Virtual|Loopback|Tailscale/i.test(name)) continue;
      candidates.push({ name, address: info.address });
    }
  }
  // Prefer Wi-Fi/Ethernet adapters, then anything else that survived the filter.
  const preferred = candidates.find((c) => /Wi-?Fi|Ethernet|WLAN/i.test(c.name));
  return (preferred ?? candidates[0])?.address ?? null;
}

async function main() {
  const deadline = Date.now() + RETRY_SECONDS * 1000;
  let ip = findLanIPv4();
  while (!ip && Date.now() < deadline) {
    console.log("[dev-qr] No LAN IPv4 address yet (Wi-Fi still connecting?), retrying...");
    await new Promise((resolve) => setTimeout(resolve, RETRY_INTERVAL_MS));
    ip = findLanIPv4();
  }
  if (!ip) {
    console.error(
      `[dev-qr] Gave up after ${RETRY_SECONDS}s: no private LAN IPv4 address found. ` +
        "Connect to Wi-Fi and rerun: node scripts/write-dev-qr.mjs",
    );
    process.exit(1);
  }

  const url = `exp://${ip}:${PORT}`;
  await QRCode.toFile(OUTPUT, url, { width: 512, margin: 2 });
  console.log(`[dev-qr] ${url}`);
  console.log(`[dev-qr] QR code saved to ${OUTPUT} - scan it with the phone camera or Expo Go.`);
}

main().catch((error) => {
  console.error("[dev-qr] Failed to write QR code:", error);
  process.exit(1);
});
