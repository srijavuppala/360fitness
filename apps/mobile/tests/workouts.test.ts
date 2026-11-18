import { strict as assert } from "node:assert";
import { test } from "node:test";
import { initialState } from "../src/domain/fixtures";
import { parseSavedState } from "../src/domain/meals";
import { dispatch, emptyWorkoutState } from "../src/domain/workouts";

test("saved app state without workouts still loads", () => {
  const restored = parseSavedState(JSON.stringify(initialState()));
  assert.equal(restored.workouts, undefined);
});

test("workouts round-trip through saved app state", () => {
  const out = dispatch(emptyWorkoutState(), { action: "log_workout", type: "run", durationMin: 25, date: "2026-11-18" });
  const saved = JSON.stringify({ ...initialState(), workouts: out.state });
  const restored = parseSavedState(saved);
  assert.equal(restored.workouts?.sessions[0].durationMin, 25);
});

test("corrupt workout data is rejected instead of silently dropped", () => {
  const saved = JSON.stringify({ ...initialState(), workouts: { version: 1, weekStartsOn: 1, goals: [], sessions: [{ id: "x" }] } });
  assert.throws(() => parseSavedState(saved));
});

test("glucose readings round-trip through saved app state", async () => {
  const { dispatchGlucose, emptyGlucoseState } = await import("../src/domain/glucose");
  const out = dispatchGlucose(emptyGlucoseState(), { action: "log_glucose", value: 110, context: "fasting" });
  const restored = parseSavedState(JSON.stringify({ ...initialState(), glucose: out.state }));
  assert.equal(restored.glucose?.readings[0].mgdl, 110);
});

test("glucose tools are offered only when diabetes was selected", async () => {
  const { tracksGlucose } = await import("../src/domain/glucose");
  assert.equal(tracksGlucose(undefined), false);
  assert.equal(tracksGlucose({ conditions: ["Diabetes (Type 1 / Type 2)"] } as never), true);
  assert.equal(tracksGlucose({ conditions: ["Kidney-related condition"] } as never), false);
});

test("an unreadable health section is quarantined, not erased by the next save", () => {
  const bad = { version: 1, consentGivenAt: "x", updatedAt: "y", conditions: ["Not a real condition"] };
  const restored = parseSavedState(JSON.stringify({ ...initialState(), health: bad }));
  assert.equal(restored.health, undefined, "app runs as not assessed");
  assert.deepEqual(restored.healthUnreadable, bad, "original kept for recovery");
  const resaved = parseSavedState(JSON.stringify(restored));
  assert.deepEqual(resaved.healthUnreadable, bad, "survives another save/load cycle");
});
