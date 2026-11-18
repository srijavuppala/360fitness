import { strict as assert } from "node:assert";
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  addDays,
  commandFromTool,
  dispatch,
  emptyWorkoutState,
  goalProgress,
  handleMessage,
  logWorkout,
  parseDistance,
  parseDuration,
  parseMessage,
  parseWorkoutState,
  setGoal,
  toolDefinitions,
  weekStart,
  weekSummary,
  type Clock,
} from "../src/index.ts";

// Wednesday 2026-11-18, local noon.
function fixedClock(date = new Date(2026, 10, 18, 12)): Clock {
  let n = 0;
  return { now: () => date, id: (prefix = "id") => `${prefix}-${++n}` };
}
const TODAY = "2026-11-18";

test("weeks start on Monday by default and survive month boundaries", () => {
  assert.equal(weekStart(TODAY), "2026-11-16");
  assert.equal(weekStart("2026-11-16"), "2026-11-16");
  assert.equal(weekStart("2026-11-22"), "2026-11-16");
  assert.equal(weekStart("2026-03-01"), "2026-02-23");
  assert.equal(weekStart(TODAY, 0), "2026-11-15");
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
});

test("logging validates input and defaults date, intensity and status", () => {
  const clock = fixedClock();
  const { state, session } = logWorkout(emptyWorkoutState(), { type: "run", durationMin: 30, distanceKm: 5 }, clock);
  assert.equal(session.date, TODAY);
  assert.equal(session.intensity, "moderate");
  assert.equal(session.status, "completed");
  assert.equal(state.sessions.length, 1);
  assert.throws(() => logWorkout(state, { type: "run", durationMin: 0 }, clock), /duration above zero/);
  assert.throws(() => logWorkout(state, { type: "run", durationMin: 2000 }, clock), /1,440/);
  assert.throws(() => logWorkout(state, { type: "dance" as never, durationMin: 20 }, clock), /Workout type/);
  assert.throws(() => logWorkout(state, { type: "run", durationMin: 20, date: "18/11/2026" }, clock), /valid date/);
});

test("idempotency key makes retries safe", () => {
  const clock = fixedClock();
  const first = logWorkout(emptyWorkoutState(), { type: "yoga", durationMin: 45, idempotencyKey: "k1" }, clock);
  const retry = logWorkout(first.state, { type: "yoga", durationMin: 45, idempotencyKey: "k1" }, clock);
  assert.equal(retry.duplicate, true);
  assert.equal(retry.state.sessions.length, 1);
  assert.equal(retry.session.id, first.session.id);
});

test("goal progress counts only completed sessions in the week and in scope", () => {
  const clock = fixedClock();
  let s = emptyWorkoutState();
  s = setGoal(s, { metric: "sessions", target: 3 }, clock).state;
  s = setGoal(s, { metric: "distanceKm", target: 10, types: ["run"] }, clock).state;
  s = logWorkout(s, { type: "run", durationMin: 30, distanceKm: 5 }, clock).state;
  s = logWorkout(s, { type: "cycle", durationMin: 60, distanceKm: 20 }, clock).state;
  s = logWorkout(s, { type: "run", durationMin: 30, distanceKm: 5, status: "planned" }, clock).state;
  s = logWorkout(s, { type: "run", durationMin: 30, distanceKm: 5, date: "2026-11-15" }, clock).state; // last week
  const [sessions, distance] = s.goals.map((g) => goalProgress(s, g, TODAY));
  assert.equal(sessions.value, 2);
  assert.equal(sessions.met, false);
  assert.equal(sessions.remaining, 1);
  assert.equal(distance.value, 5, "cycling distance and planned/last-week runs excluded");
});

test("setting the same goal twice replaces it instead of stacking", () => {
  const clock = fixedClock();
  let out = setGoal(emptyWorkoutState(), { metric: "sessions", target: 3 }, clock);
  out = setGoal(out.state, { metric: "sessions", target: 4 }, clock);
  assert.equal(out.replaced, true);
  assert.equal(out.state.goals.length, 1);
  assert.equal(out.state.goals[0].target, 4);
  assert.equal(out.state.goals[0].title, "4 workouts a week");
  assert.throws(() => setGoal(out.state, { metric: "activeDays", target: 8 }, clock), /at most 7/);
});

test("streak counts consecutive met weeks; an unfinished week does not break it", () => {
  const clock = fixedClock();
  let s = setGoal(emptyWorkoutState(), { metric: "sessions", target: 1 }, clock).state;
  for (const date of ["2026-11-03", "2026-11-10"]) s = logWorkout(s, { type: "walk", durationMin: 20, date }, clock).state;
  assert.equal(weekSummary(s, TODAY).goalStreakWeeks, 2);
  s = logWorkout(s, { type: "walk", durationMin: 20 }, clock).state;
  assert.equal(weekSummary(s, TODAY).goalStreakWeeks, 3);
});

test("text parser understands common chat phrasings", () => {
  assert.equal(parseDuration("1h 15"), 75);
  assert.equal(parseDuration("1:30 ride"), 90);
  assert.equal(parseDuration("45 min"), 45);
  assert.equal(parseDistance("3.1 miles"), 4.99);
  assert.deepEqual(parseMessage("Ran 5k in 28 min", TODAY), { action: "log_workout", type: "run", durationMin: 28, distanceKm: 5 });
  assert.deepEqual(parseMessage("45 min yoga easy", TODAY), { action: "log_workout", type: "yoga", durationMin: 45, intensity: "easy" });
  assert.deepEqual(parseMessage("lifted 1h hard yesterday", TODAY), {
    action: "log_workout",
    type: "strength",
    durationMin: 60,
    intensity: "hard",
    date: "2026-11-17",
  });
  assert.deepEqual(parseMessage("goal 3 workouts a week", TODAY), { action: "set_goal", metric: "sessions", target: 3 });
  assert.deepEqual(parseMessage("goal 150 minutes per week", TODAY), { action: "set_goal", metric: "minutes", target: 150 });
  assert.deepEqual(parseMessage("goal run 20 km a week", TODAY), { action: "set_goal", metric: "distanceKm", target: 20, types: ["run"] });
  assert.deepEqual(parseMessage("goal 4 active days", TODAY), { action: "set_goal", metric: "activeDays", target: 4 });
  assert.equal(parseMessage("status", TODAY)?.action, "summary");
  assert.equal(parseMessage("undo", TODAY)?.action, "undo_last");
  assert.equal(parseMessage("ran 5k", TODAY)?.action, "clarify");
  assert.deepEqual(parseMessage("skipped run, knee sore", TODAY), {
    action: "log_workout",
    type: "run",
    durationMin: 0,
    status: "skipped",
    skipReason: "knee sore",
  });
  assert.equal(parseMessage("what's for dinner", TODAY), null);
});

test("message adapter replies, de-duplicates webhook redelivery and undoes only its own logs", () => {
  const clock = fixedClock();
  let state = logWorkout(emptyWorkoutState(), { type: "swim", durationMin: 40, source: "app" }, clock).state;
  let out = handleMessage(state, "goal 3 workouts a week", { clock });
  assert.match(out.reply, /Goal set: 3 workouts a week/);
  state = out.state;
  out = handleMessage(state, "ran 5k in 28 min", { clock, messageId: "m-1" });
  assert.match(out.reply, /Logged/);
  assert.match(out.reply, /2\/3/);
  state = out.state;
  out = handleMessage(state, "ran 5k in 28 min", { clock, messageId: "m-1" });
  assert.match(out.reply, /Already logged/);
  assert.equal(out.state.sessions.length, 2);
  out = handleMessage(out.state, "undo", { clock });
  assert.match(out.reply, /Removed: 28 min run/);
  out = handleMessage(out.state, "undo", { clock });
  assert.match(out.reply, /Nothing to undo/);
  assert.equal(out.state.sessions[0].type, "swim", "app-logged swim untouched");
  assert.match(handleMessage(state, "blah", { clock }).reply, /didn't catch that/);
});

test("dispatch never throws for bad input and returns structured errors", () => {
  const out = dispatch(emptyWorkoutState(), { action: "delete_workout", id: "nope" });
  assert.deepEqual(out.result, { ok: false, error: { code: "not_found", message: "That workout was not found." } });
  const bad = dispatch(emptyWorkoutState(), { action: "log_workout", type: "run", durationMin: -5 });
  assert.equal(bad.result.ok, false);
});

test("tool definitions map to commands and cannot be spoofed via arguments", () => {
  assert.ok(toolDefinitions.every((t) => t.inputSchema.type === "object"));
  assert.equal(commandFromTool("nope", {}), null);
  assert.equal(commandFromTool("summary", { action: "delete_workout" })?.action, "summary");
});

test("persisted state round-trips and corrupt data is rejected", () => {
  const { state } = logWorkout(emptyWorkoutState(), { type: "hiit", durationMin: 20 }, fixedClock());
  assert.deepEqual(parseWorkoutState(JSON.stringify(state)), state);
  assert.throws(() => parseWorkoutState('{"version":2}'), /unknown version/);
});

test("MCP server speaks JSON-RPC over stdio and persists to its data file", async () => {
  const dir = mkdtempSync(join(tmpdir(), "wk-mcp-"));
  const file = join(dir, "workouts.json");
  const child = spawn(process.execPath, [new URL("../bin/mcp-server.ts", import.meta.url).pathname], {
    env: { ...process.env, WORKOUT_DATA_FILE: file },
    stdio: ["pipe", "pipe", "inherit"],
  });
  const lines: Record<string, unknown>[] = [];
  let buffer = "";
  child.stdout.on("data", (chunk) => {
    buffer += chunk;
    let i;
    while ((i = buffer.indexOf("\n")) >= 0) {
      lines.push(JSON.parse(buffer.slice(0, i)));
      buffer = buffer.slice(i + 1);
    }
  });
  const requests = [
    { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "t", version: "1" } } },
    { jsonrpc: "2.0", method: "notifications/initialized" },
    { jsonrpc: "2.0", id: 2, method: "tools/list" },
    { jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "log_workout", arguments: { type: "run", durationMin: 30, distanceKm: 5 } } },
    { jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "summary", arguments: {} } },
    { jsonrpc: "2.0", id: 5, method: "tools/call", params: { name: "bogus", arguments: {} } },
  ];
  for (const r of requests) child.stdin.write(`${JSON.stringify(r)}\n`);
  const deadline = Date.now() + 10000;
  while (lines.length < 5 && Date.now() < deadline) await new Promise((r) => setTimeout(r, 50));
  child.kill();
  const byId = Object.fromEntries(lines.map((l) => [l.id, l])) as Record<number, any>;
  assert.equal(byId[1].result.serverInfo.name, "360fitness-workouts");
  assert.ok(byId[2].result.tools.some((t: { name: string }) => t.name === "set_goal"));
  assert.equal(byId[3].result.isError, false);
  assert.match(byId[3].result.content[0].text, /Logged/);
  assert.equal(byId[4].result.structuredContent.summary.sessions, 1);
  assert.equal(byId[5].error.code, -32602);
  const saved = JSON.parse(readFileSync(file, "utf8"));
  assert.equal(saved.sessions[0].source, "mcp");
});

test("parser stays fast on adversarial input (CodeQL polynomial-regex finding)", () => {
  const evil = "0".repeat(100000) + "x";
  const start = performance.now();
  parseDuration(evil);
  parseDistance(evil);
  parseMessage(`ran ${evil}`, TODAY);
  parseMessage(`goal ${evil}`, TODAY);
  assert.ok(performance.now() - start < 200, "parsing a 100k-char message must stay well under 200 ms");
  assert.equal(parseDuration("x1h 15"), 75, "numbers after letters still parse");
  assert.equal(parseDistance("10.5km"), 10.5);
});
