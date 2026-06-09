const path = require("path");
const puppeteer = require("puppeteer");

const HTML = "file://" + path.resolve(__dirname, process.argv[2] || "../index.html");
const OUT = path.resolve(__dirname, process.argv[3] || "../Shape-by-Ajay-Pitch.pdf");
const CHROMIUM = process.env.CHROMIUM_BIN;

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROMIUM,
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });
  try {
    const page = await browser.newPage();
    await page.goto(HTML, { waitUntil: "networkidle0", timeout: 120000 });
    await page.evaluateHandle("document.fonts.ready");
    await new Promise((r) => setTimeout(r, 1500));
    await page.pdf({
      path: OUT,
      width: "1280px",
      height: "720px",
      printBackground: true,
      pageRanges: "1-10",
    });
    console.log("PDF_OK " + OUT);
  } catch (e) {
    console.log("PDF_FAIL", e.message);
  } finally {
    await browser.close();
  }
})();
