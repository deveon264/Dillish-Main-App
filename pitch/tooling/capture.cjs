const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer");

const BASE = "https://" + process.env.REPLIT_DEV_DOMAIN;
const TOKEN = fs.readFileSync(path.join(__dirname, "../../.local/state/pitch/token.txt"), "utf8").trim();
const UID = "1780855991928qig58vfxu";
const CHROMIUM = process.env.CHROMIUM_BIN;
const OUT = path.join(__dirname, "../assets");
fs.mkdirSync(OUT, { recursive: true });

const now = Date.now();
const day = 86400000;
const k = (slice) => `florish:u:${UID}:${slice}`;

const water = [];
for (let i = 0; i < 6; i++) water.push({ id: "w" + i, amountMl: 250, ts: now - i * 90 * 60000 });

const calories = [
  { id: "c1", name: "Greek yogurt & berries", kcal: 320, protein: 24, carbs: 38, fats: 8, ts: now - 6 * 3600000, mealType: "Breakfast" },
  { id: "c2", name: "Grilled chicken salad", kcal: 480, protein: 42, carbs: 30, fats: 18, ts: now - 2 * 3600000, mealType: "Lunch" },
  { id: "c3", name: "Protein smoothie", kcal: 280, protein: 30, carbs: 24, fats: 6, ts: now - 1 * 3600000, mealType: "Snack" },
];

const weightVals = [68, 66.6, 65.4, 64.5, 63.6, 62.8, 62];
const weight = weightVals.map((wv, i) => ({ id: "wt" + i, weight: wv, ts: now - (weightVals.length - 1 - i) * 7 * day })).sort((a, b) => b.ts - a.ts);

const seed = {
  [k("water")]: JSON.stringify(water),
  [k("calories")]: JSON.stringify(calories),
  [k("weight")]: JSON.stringify(weight),
};

async function settle(page, ms) {
  await new Promise((r) => setTimeout(r, ms));
}

async function waitForApp(page, mustInclude) {
  try {
    await page.waitForFunction(
      (txt) => {
        const t = document.body ? document.body.innerText : "";
        return t.length > 150 && (!txt || t.includes(txt));
      },
      { timeout: 45000 },
      mustInclude || null
    );
  } catch (e) {
    console.log("  (waitForApp soft-timeout)");
  }
}

async function shoot(page, urlPath, file, mustInclude) {
  console.log("-> " + urlPath);
  await page.goto(BASE + urlPath, { waitUntil: "networkidle2", timeout: 120000 });
  await waitForApp(page, mustInclude);
  await settle(page, 3500);
  await page.screenshot({ path: path.join(OUT, file) });
  console.log("   saved " + file);
}

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROMIUM,
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--hide-scrollbars"],
    defaultViewport: { width: 430, height: 932, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  });
  try {
    // 1) Welcome (no session)
    const page = await browser.newPage();
    await page.goto(BASE + "/welcome", { waitUntil: "networkidle2", timeout: 120000 });
    await waitForApp(page, "AJAY");
    await settle(page, 3000);
    await page.screenshot({ path: path.join(OUT, "welcome.png") });
    console.log("   saved welcome.png");

    // 2) Inject session + seeded device-local data on the app origin
    await page.evaluate(
      (token, seedObj) => {
        localStorage.setItem("florish_session", token);
        for (const [key, val] of Object.entries(seedObj)) localStorage.setItem(key, val);
      },
      TOKEN,
      seed
    );

    // 3) Authenticated screens
    await shoot(page, "/", "home.png", "Ajay");
    await shoot(page, "/workouts", "workouts.png");
    await shoot(page, "/calories", "calories.png");
    await shoot(page, "/progress", "progress.png");
    await shoot(page, "/profile", "profile.png");

    console.log("DONE");
  } catch (e) {
    console.log("ERROR", e.message);
  } finally {
    await browser.close();
  }
})();
