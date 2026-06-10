import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";

// =========================================================================
// Why this suite exists
// =========================================================================
// The on-device Maestro flow in `.maestro/` cannot run in this container (no
// emulator/simulator). But the thing that silently rots is the contract between
// a flow and the app: a flow targets elements by `testID`, and a refactor that
// renames or drops a testID makes the flow fail only on the next mobile-CI run,
// far from the change. This suite runs in the normal `npm test` pass and fails
// fast when a flow references a testID the app no longer renders, so the E2E
// flow stays wired to the screens it drives.

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const MAESTRO_DIR = join(ROOT, ".maestro");

// Recursively collect files under a dir whose name matches `pred`.
function walk(dir: string, pred: (name: string) => boolean): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name.startsWith(".") && name !== ".maestro") {
      // skip noise; .maestro itself is passed in explicitly so this only guards
      // nested hidden dirs.
    }
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (name === "node_modules" || name === ".git" || name === ".expo") continue;
      out.push(...walk(full, pred));
    } else if (pred(name)) {
      out.push(full);
    }
  }
  return out;
}

// --- The testIDs the app actually renders --------------------------------
// Pull every `testID="..."` (string literal) and `testID={`...`}` (template)
// out of the app + components source. A template like `exercise-card-${i}`
// contributes the literal prefix before its first interpolation, so a flow id
// such as `exercise-card-0` can be matched against it.
function collectSourceTestIds(): { exact: Set<string>; prefixes: string[] } {
  const exact = new Set<string>();
  const prefixes: string[] = [];
  const srcRoots = [join(ROOT, "app"), join(ROOT, "components")];
  const reString = /testID=("([^"]+)"|'([^']+)')/g;
  const reTemplate = /testID=\{`([^`]*)`\}/g;
  for (const root of srcRoots) {
    for (const file of walk(root, (n) => n.endsWith(".tsx") || n.endsWith(".ts"))) {
      const code = readFileSync(file, "utf8");
      let m: RegExpExecArray | null;
      while ((m = reString.exec(code))) exact.add(m[2] ?? m[3]);
      while ((m = reTemplate.exec(code))) {
        const tmpl = m[1];
        const cut = tmpl.indexOf("${");
        if (cut === -1) exact.add(tmpl);
        else if (cut > 0) prefixes.push(tmpl.slice(0, cut));
      }
    }
  }
  return { exact, prefixes };
}

// --- The testIDs the flows reference -------------------------------------
// Maestro selectors carry the testID under an `id:` key. Walk every parsed YAML
// node and collect each `id` string. A flow id may interpolate a flow env var
// (`workout-card-${MAESTRO_WORKOUT_ID}`); we keep the literal prefix for those.
function collectFlowIds(node: unknown, out: Set<string>): void {
  if (Array.isArray(node)) {
    for (const n of node) collectFlowIds(n, out);
    return;
  }
  if (node && typeof node === "object") {
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      if (k === "id" && typeof v === "string") out.add(v);
      else collectFlowIds(v, out);
    }
  }
}

function flowIdMatches(
  flowId: string,
  source: { exact: Set<string>; prefixes: string[] },
): boolean {
  // Resolve the static portion of an interpolated id to its literal prefix.
  const interp = flowId.indexOf("${");
  const prefix = interp === -1 ? flowId : flowId.slice(0, interp);
  if (interp === -1 && source.exact.has(flowId)) return true;
  // A concrete flow id (e.g. exercise-card-0) is covered by a source template
  // prefix (exercise-card-); an interpolated flow id is covered by a source
  // template sharing its prefix.
  for (const p of source.prefixes) {
    if (interp === -1 ? flowId.startsWith(p) : p === prefix || p.startsWith(prefix) || prefix.startsWith(p)) {
      return true;
    }
  }
  // An interpolated id could also resolve to an exact source id that starts with
  // its literal prefix (defensive; not currently relied on).
  if (interp !== -1) {
    for (const e of source.exact) if (e.startsWith(prefix)) return true;
  }
  return false;
}

const flowFiles = walk(MAESTRO_DIR, (n) => n.endsWith(".yaml") || n.endsWith(".yml"));

test("every .maestro flow file is valid YAML", () => {
  assert.ok(flowFiles.length >= 2, "expected at least the main flow and the login subflow");
  for (const file of flowFiles) {
    const raw = readFileSync(file, "utf8");
    // A Maestro flow file is a multi-doc YAML (header `---` then commands);
    // `parseAllDocuments` via parse on the joined source is enough to catch
    // syntax errors, which is all this assertion needs.
    assert.doesNotThrow(() => {
      for (const doc of raw.split(/^---$/m)) {
        if (doc.trim()) parse(doc);
      }
    }, `invalid YAML in ${file}`);
  }
});

test("every testID referenced by a Maestro flow exists in the app source", () => {
  const source = collectSourceTestIds();
  // Sanity: the source scan must actually find our known testIDs, otherwise the
  // check below would pass vacuously after a regex/path regression.
  for (const known of ["player-play-toggle", "rest-screen", "login-submit"]) {
    assert.ok(source.exact.has(known), `source scan missed the '${known}' testID`);
  }

  const flowIds = new Set<string>();
  for (const file of flowFiles) {
    const raw = readFileSync(file, "utf8");
    for (const doc of raw.split(/^---$/m)) {
      if (!doc.trim()) continue;
      const parsed = parse(doc);
      collectFlowIds(parsed, flowIds);
    }
  }
  assert.ok(flowIds.size > 0, "no testID selectors found in any flow");

  const missing = [...flowIds].filter((id) => !flowIdMatches(id, source));
  assert.deepEqual(
    missing,
    [],
    `Maestro flows reference testIDs that no longer exist in app/ or components/: ${missing.join(", ")}`,
  );
});
