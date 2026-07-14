const qrcode = require("qrcode-terminal");

const url = process.argv[2];

if (!url) {
  console.error("Usage: node scripts/print-expo-qr.cjs <expo-url>");
  process.exit(1);
}

qrcode.generate(url, { small: true }, (qr) => {
  console.log(qr);
});
