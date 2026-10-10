import { test } from "node:test";
import assert from "node:assert/strict";
import {
  emptyState,
  starterMeals,
  logMeal,
  parseBackup,
  validateState,
  validDate,
  changedRecords,
  recordMap,
  stateFromRecords,
  historyDays,
  averageLogged,
  parseMealEstimate,
  type WebState,
} from "../src/lib/model";
const date = "2026-10-06";
test("new workspaces have no fabricated history or automatic calorie targets", () => {
  const state = emptyState();
  assert.equal(state.entries.length, 0);
  assert.equal(state.profile.kcal, null);
  assert.equal(state.templates.length, 0);
});
test("template confirmation is idempotent and does not mutate usual meals", () => {
  const before = { ...emptyState(), templates: structuredClone(starterMeals) };
  const first = logMeal(before, before.templates[0], date);
  const second = logMeal(first, before.templates[0], date);
  assert.equal(second.entries.length, 1);
  assert.equal(before.entries.length, 0);
  second.entries[0].foods[0].nutrition.kcal = 999;
  assert.notEqual(before.templates[0].foods[0].nutrition.kcal, 999);
});
test("cloud writes are isolated per changed record", () => {
  const before = logMeal(emptyState(), starterMeals[0], date);
  const after = logMeal(before, starterMeals[1], date);
  const changes = changedRecords(before, after);
  assert.equal(changes.length, 1);
  assert.equal(changes[0].key, `entry-${date}-${starterMeals[1].id}`);
  const removed = {
    ...after,
    entries: after.entries.filter((m) => m.id !== starterMeals[0].id),
  };
  assert.equal(changedRecords(after, removed)[0].value, null);
});
test("cloud records and backups round-trip with unknown values", () => {
  const meal = structuredClone(starterMeals[0]);
  meal.foods[0].nutrition.kcal = null;
  const state = logMeal(emptyState(), meal, date);
  assert.deepEqual(stateFromRecords(Object.values(recordMap(state))), state);
  assert.deepEqual(parseBackup(JSON.stringify(state)), state);
});
test("backup validation rejects malformed dates, duplicates, invalid targets and sources", () => {
  assert.equal(validDate("2026-02-30"), false);
  assert.equal(validDate("2024-02-29"), true);
  for (const mutate of [
    (s: WebState) => {
      s.profile.kcal = -1;
    },
    (s: WebState) => {
      s.profile.water = 0;
    },
    (s: WebState) => {
      s.entries[0].date = "2026-02-30";
    },
    (s: WebState) => {
      s.entries.push(s.entries[0]);
    },
    (s: WebState) => {
      s.entries[0].foods[0].source = "bad" as "manual";
    },
    (s: WebState) => {
      s.entries[0].id = "../../other-user";
    },
  ]) {
    const state = logMeal(emptyState(), starterMeals[0], date);
    mutate(state);
    assert.throws(() => validateState(state));
  }
  assert.throws(() => parseBackup("{}"));
  assert.throws(() => parseBackup("x".repeat(5_000_001)));
});
test("missing and unknown days are never zeroed for averages", () => {
  const state = logMeal(emptyState(), starterMeals[0], date);
  const days = historyDays(state.entries, 7, new Date(2026, 9, 6, 12));
  assert.equal(averageLogged(days, "kcal"), 300);
  assert.equal(days[0].nutrition, null);
});
test("AI imports remain drafts until explicitly logged", () => {
  const state = emptyState();
  const draft = parseMealEstimate(
    '{"items":[{"name":"Toast","quantity":1,"unit":"slice","calories":90,"protein_g":4,"carbs_g":15,"fat_g":1.5}]}',
    "Toast",
  );
  assert.equal(state.entries.length, 0);
  assert.equal(logMeal(state, draft, date).entries[0].foods[0].source, "ai");
  assert.throws(() =>
    parseMealEstimate(
      '{"items":[{"name":"Toast","quantity":1,"unit":"slice","calories":-90}]}',
      "Toast",
    ),
  );
});
test("deleting a usual meal cannot remove previously logged snapshots", () => {
  const state = logMeal(
    { ...emptyState(), templates: structuredClone(starterMeals) },
    starterMeals[0],
    date,
  );
  const next = { ...state, templates: [] };
  assert.equal(next.entries.length, 1);
  assert.equal(changedRecords(state, next).length, 3);
});
