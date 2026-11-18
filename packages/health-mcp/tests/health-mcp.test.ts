import { strict as assert } from "node:assert";
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { callTool, emptyHealthState, handleHealthMessage, healthToolDefinitions, parseHealthState } from "../src/health.ts";

const clock = () => {
  let n = 0;
  return { now: () => new Date(2026, 10, 18, 12), id: (p = "id") => `${p}-${++n}` };
};

test("tool names are unique across cores", () => {
  const names = healthToolDefinitions.map((t) => t.name);
  assert.equal(new Set(names).size, names.length);
  assert.ok(names.includes("log_glucose") && names.includes("log_workout"));
});

test("messages route to glucose or workouts and share one state", () => {
  const c = clock();
  let s = emptyHealthState();
  let out = handleHealthMessage(s, "glucose 62 fasting", { clock: c, messageId: "a" });
  assert.match(out.reply, /Logged: 62 mg\/dL fasting/);
  assert.match(out.reply, /low-glucose plan/);
  s = out.state;
  out = handleHealthMessage(s, "walked 30 min", { clock: c, messageId: "b" });
  assert.match(out.reply, /Logged 💪 30 min walk/);
  s = out.state;
  assert.equal(s.glucose.readings.length, 1);
  assert.equal(s.workouts.sessions.length, 1);
  assert.match(handleHealthMessage(s, "help").reply, /Glucose:/);
  assert.match(handleHealthMessage(s, "asdf").reply, /Glucose:/);
});

test("callTool rejects unknown tools and keeps state on errors", () => {
  const s = emptyHealthState();
  assert.equal(callTool(s, "nope", {}, "mcp"), null);
  const bad = callTool(s, "log_glucose", { value: 4000 }, "mcp")!;
  assert.equal(bad.isError, true);
  assert.equal(bad.state, s);
});

test("state from older files without glucose still loads", () => {
  const loaded = parseHealthState({ version: 1, workouts: emptyHealthState().workouts });
  assert.equal(loaded.glucose.readings.length, 0);
});

test("stdio server lists both tool sets, logs glucose and persists", async () => {
  const dir = mkdtempSync(join(tmpdir(), "health-mcp-"));
  const file = join(dir, "health.json");
  const child = spawn(process.execPath, [new URL("../bin/server.ts", import.meta.url).pathname], {
    env: { ...process.env, HEALTH_DATA_FILE: file },
    stdio: ["pipe", "pipe", "inherit"],
  });
  const lines: any[] = [];
  let buf = "";
  child.stdout.on("data", (d) => {
    buf += d;
    let i;
    while ((i = buf.indexOf("\n")) >= 0) {
      lines.push(JSON.parse(buf.slice(0, i)));
      buf = buf.slice(i + 1);
    }
  });
  for (const r of [
    { jsonrpc: "2.0", id: 1, method: "initialize", params: {} },
    { jsonrpc: "2.0", id: 2, method: "tools/list" },
    { jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "log_glucose", arguments: { value: 7.8, context: "after_meal" } } },
    { jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "glucose_summary", arguments: {} } },
  ])
    child.stdin.write(`${JSON.stringify(r)}\n`);
  const end = Date.now() + 10000;
  while (lines.length < 4 && Date.now() < end) await new Promise((r) => setTimeout(r, 50));
  child.kill();
  const by = Object.fromEntries(lines.map((l) => [l.id, l]));
  assert.match(by[1].result.instructions, /Never diagnose/);
  assert.ok(by[2].result.tools.length >= 16);
  assert.match(by[3].result.content[0].text, /141 mg\/dL after a meal/);
  assert.equal(by[4].result.structuredContent.summary.count, 1);
  assert.equal(JSON.parse(readFileSync(file, "utf8")).glucose.readings[0].source, "mcp");
});
