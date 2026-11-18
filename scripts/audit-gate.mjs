#!/usr/bin/env node
/**
 * Dependency audit gate for CI.
 *
 *   node scripts/audit-gate.mjs <package-dir> [--level high]
 *
 * Fails when a production dependency has an advisory at or above `--level`
 * (default: high) unless that advisory is listed in
 * .github/audit-allowlist.json with a reason and an expiry date. Expired
 * allowlist entries fail the gate, so exceptions can't quietly become
 * permanent.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dir = process.argv[2];
if (!dir) {
  console.error("usage: audit-gate.mjs <package-dir> [--level high|critical|moderate]");
  process.exit(2);
}
const levelIndex = process.argv.indexOf("--level");
const level = levelIndex > 0 ? process.argv[levelIndex + 1] : "high";
const rank = { info: 0, low: 1, moderate: 2, high: 3, critical: 4 };

let report;
try {
  report = execFileSync("npm", ["audit", "--omit=dev", "--json"], { cwd: resolve(root, dir), encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
} catch (error) {
  // npm audit exits non-zero when it finds anything; the JSON is still on stdout.
  report = error.stdout;
  if (!report) throw error;
}
const audit = JSON.parse(report);
if (audit.error) {
  console.error(`npm audit failed: ${audit.error.summary ?? JSON.stringify(audit.error)}`);
  process.exit(1);
}

const allowlist = JSON.parse(readFileSync(join(root, ".github/audit-allowlist.json"), "utf8"));
const today = new Date().toISOString().slice(0, 10);
const allowed = new Map();
let failed = false;
for (const entry of allowlist.entries ?? []) {
  if (entry.package_dir !== dir) continue;
  if (!entry.reason || !entry.expires) {
    console.error(`::error::Allowlist entry ${entry.advisory} needs a reason and an expires date.`);
    failed = true;
  } else if (entry.expires < today) {
    console.error(`::error::Allowlist entry ${entry.advisory} for ${dir} expired on ${entry.expires}. Fix the dependency or renew with a new reason.`);
    failed = true;
  } else allowed.set(entry.advisory, entry);
}

const findings = [];
for (const [name, vuln] of Object.entries(audit.vulnerabilities ?? {})) {
  for (const via of vuln.via) {
    if (typeof via !== "object") continue; // transitive pointer; the root advisory is reported on its own package
    if (rank[via.severity] < rank[level]) continue;
    const id = via.url?.split("/").pop() ?? String(via.source);
    findings.push({ name, id, severity: via.severity, title: via.title, allowed: allowed.has(id) });
  }
}

for (const f of findings) {
  const line = `${f.severity.toUpperCase()} ${f.name}: ${f.title} (${f.id})`;
  if (f.allowed) console.log(`allowed  ${line} — ${allowed.get(f.id).reason} (until ${allowed.get(f.id).expires})`);
  else {
    console.error(`::error::${dir}: ${line}`);
    failed = true;
  }
}
const blocking = findings.filter((f) => !f.allowed).length;
console.log(`${dir}: ${findings.length} advisories at or above ${level}, ${blocking} blocking.`);
process.exit(failed ? 1 : 0);
