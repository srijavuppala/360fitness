import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  addReading,
  classify,
  dispatchGlucose,
  emptyGlucoseState,
  formatGlucoseReply,
  fromMgdl,
  glucoseCommandFromTool,
  mealResponses,
  parseGlucoseMessage,
  parseGlucoseState,
  safetyNotice,
  summarize,
  toMgdl,
  type Clock,
} from "../src/index.ts";

const NOW = new Date(2026, 10, 18, 12, 0);
function clock(now = NOW): Clock {
  let n = 0;
  return { now: () => now, id: (p = "id") => `${p}-${++n}` };
}
const at = (day: number, hour: number) => new Date(2026, 10, day, hour, 0).toISOString();

test("unit conversion matches the standard 18.0182 factor and round-trips", () => {
  assert.equal(toMgdl(5.5, "mmol/L"), 99);
  assert.equal(toMgdl(10, "mmol/L"), 180);
  assert.equal(fromMgdl(180, "mmol/L"), 10);
  assert.equal(fromMgdl(70, "mmol/L"), 3.9);
  assert.equal(fromMgdl(54, "mmol/L"), 3);
});

test("classification uses consensus bands and the safety thresholds cannot be loosened", () => {
  assert.equal(classify(53), "very_low");
  assert.equal(classify(54), "low");
  assert.equal(classify(69), "low");
  assert.equal(classify(70), "in_range");
  assert.equal(classify(180), "in_range");
  assert.equal(classify(181), "high");
  assert.equal(classify(251), "very_high");
  // A clinician range of 80–160 tightens "in range" but 54/70 stay fixed.
  const t = { lowMgdl: 80, highMgdl: 160, source: "CLINICIAN_PROVIDED" as const };
  assert.equal(classify(75, t), "low");
  assert.equal(classify(170, t), "high");
  assert.equal(classify(50, t), "very_low");
});

test("readings validate value, unit and time; implausible values are rejected as likely typos", () => {
  const c = clock();
  const s = emptyGlucoseState();
  assert.equal(addReading(s, { value: 6.2 }, c).reading.entered.unit, "mmol/L", "≤35 inferred as mmol/L");
  assert.equal(addReading(s, { value: 6.2 }, c).reading.mgdl, 112);
  assert.equal(addReading(s, { value: 142 }, c).reading.entered.unit, "mg/dL");
  assert.throws(() => addReading(s, { value: 1500 }, c), /between 20 and 600/);
  assert.throws(() => addReading(s, { value: 5, unit: "mg/dL" }, c), /Check the number and unit/);
  assert.throws(() => addReading(s, { value: 100, takenAt: new Date(2026, 10, 19).toISOString() }, c), /future/);
});

test("low readings carry a safety notice; normal readings do not", () => {
  assert.match(safetyNotice(50)!, /very low.*911/s);
  assert.match(safetyNotice(65)!, /below 70/);
  assert.match(safetyNotice(320)!, /very high/);
  assert.equal(safetyNotice(120), null);
  const out = addReading(emptyGlucoseState(), { value: 62 }, clock());
  assert.match(out.notice!, /low-glucose plan/);
});

test("idempotency key prevents duplicate readings", () => {
  const c = clock();
  const a = addReading(emptyGlucoseState(), { value: 110, idempotencyKey: "m1" }, c);
  const b = addReading(a.state, { value: 110, idempotencyKey: "m1" }, c);
  assert.equal(b.duplicate, true);
  assert.equal(b.state.readings.length, 1);
});

test("summary reports gaps honestly and never calls fingersticks time-in-range", () => {
  const c = clock();
  let s = emptyGlucoseState();
  for (const [day, value] of [
    [18, 100],
    [18, 200],
    [17, 65],
    [10, 150],
  ] as const)
    s = addReading(s, { value, takenAt: at(day, 8), context: "fasting" }, c).state;
  const sum = summarize(s, 7, "2026-11-18");
  assert.equal(sum.count, 3, "reading from the 10th is outside the 7-day window");
  assert.equal(sum.daysWithReadings, 2);
  assert.equal(sum.averageMgdl, 122);
  assert.equal(sum.lowEvents, 1);
  assert.equal(sum.percent!.in_range, 33.3);
  assert.equal(sum.continuous, false);
  const reply = formatGlucoseReply({ ok: true, action: "glucose_summary", summary: sum, unit: "mg/dL" });
  assert.match(reply, /2 of 7 days/);
  assert.match(reply, /readings in range/);
  assert.match(reply, /1 low reading/);
  assert.equal(summarize(emptyGlucoseState(), 14, "2026-11-18").percent, null, "no data is not 0% or 100%");
});

test("meal responses pair before and after readings", () => {
  const c = clock();
  let s = emptyGlucoseState();
  s = addReading(s, { value: 105, context: "before_meal", takenAt: at(18, 9), mealId: "m1" }, c).state;
  s = addReading(s, { value: 165, context: "after_meal", takenAt: at(18, 11), mealId: "m1" }, c).state;
  assert.deepEqual(mealResponses(s), [{ mealId: "m1", beforeMgdl: 105, afterMgdl: 165, riseMgdl: 60, minutesAfter: 120 }]);
});

test("chat parser and tool mapping", () => {
  assert.deepEqual(parseGlucoseMessage("glucose 142 after lunch"), { action: "log_glucose", value: 142, context: "after_meal" });
  assert.deepEqual(parseGlucoseMessage("bg 6.2 mmol fasting"), { action: "log_glucose", value: 6.2, context: "fasting", unit: "mmol/L" });
  assert.equal(parseGlucoseMessage("glucose summary")?.action, "glucose_summary");
  assert.equal(parseGlucoseMessage("ran 5k in 28 min"), null);
  assert.equal(glucoseCommandFromTool("glucose_summary", { action: "delete_glucose" })?.action, "glucose_summary");
});

test("clinician target range is stored and validated", () => {
  const out = dispatchGlucose(emptyGlucoseState(), { action: "set_glucose_target", low: 80, high: 160 });
  assert.equal(out.state.target.source, "CLINICIAN_PROVIDED");
  const bad = dispatchGlucose(emptyGlucoseState(), { action: "set_glucose_target", low: 50, high: 160 });
  assert.equal(bad.result.ok, false);
});

test("persisted state round-trips and corrupt data is rejected", () => {
  const { state } = addReading(emptyGlucoseState(), { value: 120 }, clock());
  assert.deepEqual(parseGlucoseState(JSON.stringify(state)), state);
  assert.throws(() => parseGlucoseState({ ...state, readings: [{ ...state.readings[0], mgdl: 9000 }] }));
});
