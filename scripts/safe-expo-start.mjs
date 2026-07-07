#!/usr/bin/env node
import { spawn } from "node:child_process";
import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const BACKUP_ROOT = path.join(ROOT, ".local-backups");
const OBJECT_ROOT = path.join(ROOT, ".local-object-storage");
const MARKER_KEY = "app_database_id";
const EXPECTED_MARKER = "florish-local-dev-v1";
const RETAIN_BACKUPS = 10;

const REQUIRED_TABLES = [
  "app_settings",
  "users",
  "exercises",
  "community_posts",
  "community_comments",
  "community_likes",
  "community_notifications",
  "push_tokens",
];

const KEY_COUNTS = [
  "users",
  "exercises",
  "community_posts",
  "community_comments",
  "community_notifications",
];

function log(message) {
  console.log(`[safe-start] ${message}`);
}

function warn(message) {
  console.warn(`[safe-start] WARNING: ${message}`);
}

function fail(message) {
  console.error(`[safe-start] ERROR: ${message}`);
  process.exitCode = 1;
}

function parseArgs(argv) {
  const own = [];
  const expo = [];
  let passthrough = false;
  for (const arg of argv) {
    if (arg === "--") {
      passthrough = true;
      continue;
    }
    if (passthrough) expo.push(arg);
    else own.push(arg);
  }
  return {
    checkOnly: own.includes("--check-only"),
    backupOnly: own.includes("--backup-only"),
    skipBackups: own.includes("--skip-backups"),
    expoArgs: expo.length ? expo : ["--lan", "--port", "8081"],
  };
}

function loadEnv() {
  const envPath = path.join(ROOT, ".env");
  if (!fs.existsSync(envPath)) {
    throw new Error(".env was not found. Refusing to start without local server config.");
  }

  const env = {};
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[match[1]] = value;
  }
  return env;
}

function readDbUrl(env) {
  if (!env.DATABASE_URL) throw new Error("DATABASE_URL is missing from .env.");
  let url;
  try {
    url = new URL(env.DATABASE_URL);
  } catch {
    throw new Error("DATABASE_URL is not a valid PostgreSQL connection URL.");
  }
  return url;
}

function verifyExpectedDatabase(url) {
  const host = url.hostname.toLowerCase();
  const port = url.port || "5432";
  const database = url.pathname.replace(/^\//, "");
  const expectedHost = process.env.SAFE_START_DB_HOST || "localhost";
  const expectedPort = process.env.SAFE_START_DB_PORT || "5432";
  const expectedDb = process.env.SAFE_START_DB_NAME || "dillish";

  if (host !== expectedHost && !(expectedHost === "localhost" && host === "127.0.0.1")) {
    throw new Error(`DATABASE_URL host is ${host}, expected ${expectedHost}.`);
  }
  if (port !== expectedPort) {
    throw new Error(`DATABASE_URL port is ${port}, expected ${expectedPort}.`);
  }
  if (database !== expectedDb) {
    throw new Error(`DATABASE_URL database is ${database}, expected ${expectedDb}.`);
  }
  if (!url.username || !url.password) {
    throw new Error("DATABASE_URL must include a username and password.");
  }

  log(`Database target checked: ${host}:${port}/${database}`);
}

async function queryCounts(pool) {
  const counts = {};
  for (const table of KEY_COUNTS) {
    const result = await pool.query(`SELECT COUNT(*)::int AS count FROM ${table}`);
    counts[table] = result.rows[0].count;
  }
  return counts;
}

async function verifyDatabase(pool) {
  await pool.query("SELECT 1");

  const missing = [];
  for (const table of REQUIRED_TABLES) {
    const result = await pool.query("SELECT to_regclass($1) AS table_name", [`public.${table}`]);
    if (!result.rows[0].table_name) missing.push(table);
  }
  if (missing.length) {
    throw new Error(
      `Required database tables are missing: ${missing.join(", ")}. ` +
        "This may be the wrong or freshly reset database."
    );
  }

  const marker = await pool.query("SELECT value FROM app_settings WHERE key = $1", [MARKER_KEY]);
  if (!marker.rows.length) {
    await pool.query(
      `INSERT INTO app_settings (key, value, updated_at)
       VALUES ($1, $2, $3)
       ON CONFLICT (key) DO NOTHING`,
      [MARKER_KEY, EXPECTED_MARKER, Date.now()]
    );
    warn(`Initialized database marker ${MARKER_KEY}=${EXPECTED_MARKER}.`);
  } else if (marker.rows[0].value !== EXPECTED_MARKER) {
    throw new Error(
      `Database marker mismatch. Found ${MARKER_KEY}=${marker.rows[0].value}, ` +
        `expected ${EXPECTED_MARKER}. Refusing to start against the wrong database.`
    );
  }

  const counts = await queryCounts(pool);
  for (const [table, count] of Object.entries(counts)) {
    if (count === 0) warn(`${table} has 0 rows.`);
  }

  const mediaCounts = countLocalMediaFiles();
  if (mediaCounts["exercise-videos"] > 0 && counts.exercises === 0) {
    warn(
      `Found ${mediaCounts["exercise-videos"]} local exercise video file(s), ` +
        "but the exercises table has 0 rows."
    );
  }
  if (mediaCounts["community-photos"] > 0 && counts.community_posts === 0) {
    warn(
      `Found ${mediaCounts["community-photos"]} local community photo file(s), ` +
        "but the community_posts table has 0 rows."
    );
  }
  if (mediaCounts["profile-avatars"] > 0 && counts.users === 0) {
    warn(
      `Found ${mediaCounts["profile-avatars"]} local avatar file(s), ` +
        "but the users table has 0 rows."
    );
  }

  log(
    "Database rows: " +
      Object.entries(counts)
        .map(([table, count]) => `${table}=${count}`)
        .join(", ")
  );
}

function countLocalMediaFiles() {
  const privateRoot = path.join(OBJECT_ROOT, "local-bucket", ".private");
  const dirs = [
    "exercise-videos",
    "exercise-posters",
    "thank-you-videos",
    "profile-avatars",
    "community-photos",
    "meal-photos",
  ];
  const counts = {};
  for (const dir of dirs) {
    const full = path.join(privateRoot, dir);
    if (!fs.existsSync(full)) {
      counts[dir] = 0;
      continue;
    }
    counts[dir] = fs
      .readdirSync(full, { withFileTypes: true })
      .filter((entry) => entry.isFile() && !entry.name.endsWith(".meta.json")).length;
  }
  return counts;
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function findPgDump() {
  const candidates = [
    process.env.PG_DUMP,
    "C:\\Program Files\\PostgreSQL\\17\\bin\\pg_dump.exe",
    "C:\\Program Files\\PostgreSQL\\16\\bin\\pg_dump.exe",
    "C:\\Program Files\\PostgreSQL\\15\\bin\\pg_dump.exe",
    "pg_dump",
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (candidate === "pg_dump" || fs.existsSync(candidate)) return candidate;
  }
  return null;
}

async function ensureDir(dir) {
  await fsp.mkdir(dir, { recursive: true });
}

async function pruneBackups(dir, keep, filter) {
  if (!fs.existsSync(dir)) return;
  const entries = await fsp.readdir(dir, { withFileTypes: true });
  const targets = [];
  for (const entry of entries) {
    if (!filter(entry)) continue;
    const full = path.join(dir, entry.name);
    const stat = await fsp.stat(full);
    targets.push({ full, mtimeMs: stat.mtimeMs });
  }
  targets.sort((a, b) => b.mtimeMs - a.mtimeMs);
  for (const old of targets.slice(keep)) {
    await fsp.rm(old.full, { recursive: true, force: true });
  }
}

async function backupDatabase(env) {
  const pgDump = findPgDump();
  if (!pgDump) {
    warn("pg_dump was not found. Skipping database backup.");
    return;
  }

  const dbBackupDir = path.join(BACKUP_ROOT, "postgres");
  await ensureDir(dbBackupDir);
  const out = path.join(dbBackupDir, `dillish-${timestamp()}.dump`);
  const dbUrl = new URL(env.DATABASE_URL);
  const childEnv = { ...process.env, PGPASSWORD: dbUrl.password };

  await new Promise((resolve, reject) => {
    const child = spawn(
      pgDump,
      [
        "--format=custom",
        "--no-owner",
        "--no-privileges",
        "--file",
        out,
        "--dbname",
        env.DATABASE_URL,
      ],
      { cwd: ROOT, env: childEnv, stdio: ["ignore", "pipe", "pipe"] }
    );

    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`pg_dump failed with exit code ${code}: ${stderr.trim()}`));
    });
  });

  log(`Database backup written: ${path.relative(ROOT, out)}`);
  await pruneBackups(dbBackupDir, RETAIN_BACKUPS, (entry) => entry.isFile() && entry.name.endsWith(".dump"));
}

async function backupObjectStorage() {
  if (!fs.existsSync(OBJECT_ROOT)) {
    warn(".local-object-storage was not found. Skipping object-storage backup.");
    return;
  }
  const storageBackupDir = path.join(BACKUP_ROOT, "object-storage");
  await ensureDir(storageBackupDir);
  const out = path.join(storageBackupDir, timestamp());
  await fsp.cp(OBJECT_ROOT, out, { recursive: true, errorOnExist: false });
  log(`Object-storage backup written: ${path.relative(ROOT, out)}`);
  await pruneBackups(storageBackupDir, RETAIN_BACKUPS, (entry) => entry.isDirectory());
}

async function runPreflight({ skipBackups }) {
  const env = loadEnv();
  const dbUrl = readDbUrl(env);
  verifyExpectedDatabase(dbUrl);

  const pool = new Pool({ connectionString: env.DATABASE_URL });
  try {
    await verifyDatabase(pool);
  } finally {
    await pool.end().catch(() => {});
  }

  if (!skipBackups) {
    await backupDatabase(env);
    await backupObjectStorage();
  }
}

function startExpo(expoArgs) {
  log(`Starting Expo: npx expo start ${expoArgs.join(" ")}`);
  const child = spawn("npx", ["expo", "start", ...expoArgs], {
    cwd: ROOT,
    stdio: "inherit",
    shell: process.platform === "win32",
    env: process.env,
  });
  child.on("exit", (code, signal) => {
    if (signal) process.kill(process.pid, signal);
    process.exit(code ?? 0);
  });
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  try {
    await runPreflight({ skipBackups: options.skipBackups });
    if (options.backupOnly) {
      log("Backup-only mode complete.");
      return;
    }
    if (options.checkOnly) {
      log("Preflight check complete.");
      return;
    }
    startExpo(options.expoArgs);
  } catch (error) {
    fail(error?.message ?? String(error));
    process.exit(1);
  }
}

main();
