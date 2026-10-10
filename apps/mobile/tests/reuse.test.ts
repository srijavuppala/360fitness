import { strict as assert } from "node:assert";
import { test } from "node:test";
import { historyDays, averageLogged } from "../src/domain/analytics";
import {
  generateMealPrompt,
  parseMealEstimate,
} from "../src/domain/mealAnalysis";
import { initialState, sampleMeals } from "../src/domain/fixtures";
import { parseSavedState, recordMeal, sumNutrition } from "../src/domain/meals";

const now = new Date(2026, 9, 6, 12);
const item = {
  name: "Toast",
  quantity: 2,
  unit: "slices",
  calories: 160,
  protein_g: 6,
  carbs_g: 30,
  fat_g: 2,
};
const response = (value: unknown) =>
  JSON.stringify({ items: [value], total: { calories: 9999 } });

test("history excludes missing and skipped-only days, while retaining true zeros", () => {
  let state = recordMeal(
    initialState(),
    sampleMeals[0],
    "2026-10-05",
    "confirmed",
  );
  state = recordMeal(state, sampleMeals[1], "2026-10-04", "skipped");
  const days = historyDays(state.entries, 7, now);
  assert.equal(days.length, 7);
  assert.equal(days[4].nutrition, null);
  assert.equal(days[4].checkedIn, true);
  assert.equal(days[6].nutrition, null);
  assert.equal(averageLogged(days, "kcal"), 300);
  const zero = {
    ...sampleMeals[0],
    foods: sampleMeals[0].foods.map((food) => ({
      ...food,
      nutrition: { kcal: 0, protein: 0, carbs: 0, fat: 0 },
    })),
  };
  state = recordMeal(state, zero, "2026-10-06", "confirmed");
  assert.equal(averageLogged(historyDays(state.entries, 7, now), "kcal"), 150);
});
test("unknown calories do not become zero or suppress known protein", () => {
  const meal = structuredClone(sampleMeals[0]);
  meal.foods[0].nutrition.kcal = null;
  const state = recordMeal(initialState(), meal, "2026-10-06", "confirmed");
  const days = historyDays(state.entries, 30, now);
  assert.equal(days.length, 30);
  assert.equal(days[0].date, "2026-09-07");
  assert.equal(averageLogged(days, "kcal"), null);
  assert.equal(averageLogged(days, "protein"), 21);
});
test("imported JSON becomes a draft, totals are recalculated, confirmation is explicit", () => {
  const before = initialState();
  const meal = parseMealEstimate(
    "```json\n" + response(item) + "\n```",
    "Toast snack",
  );
  assert.equal(before.entries.length, 0);
  assert.equal(meal.foods[0].source, "ai");
  assert.equal(sumNutrition(meal.foods).kcal, 160);
  let state = recordMeal(before, meal, "2026-10-06", "confirmed");
  state = recordMeal(state, meal, "2026-10-06", "confirmed");
  assert.equal(state.entries.length, 1);
  assert.deepEqual(parseSavedState(JSON.stringify(state)), state);
});
test("upstream string portions are accepted only with an explicit number and unit", () => {
  const { unit, ...legacy } = item;
  assert.equal(
    parseMealEstimate(response({ ...legacy, quantity: "150 g" }), "Toast")
      .foods[0].quantity,
    150,
  );
  assert.throws(() =>
    parseMealEstimate(response({ ...legacy, quantity: "a bowl" }), "Toast"),
  );
});
test("untrusted estimates reject invalid types, bounds and malformed payloads", () => {
  for (const change of [
    { calories: -1 },
    { calories: "160" },
    { protein_g: 10001 },
    { quantity: 0 },
    { quantity: "2" },
    { unit: "" },
    { name: "" },
    { fat_g: [] },
    { carbs_g: true },
  ]) {
    assert.throws(() =>
      parseMealEstimate(response({ ...item, ...change }), "Meal"),
    );
  }
  for (const raw of [
    "null",
    "[]",
    '{"items":[]}',
    '{"items":[null]}',
    JSON.stringify({ items: Array(31).fill(item) }),
    "x".repeat(30001),
  ]) {
    assert.throws(() => parseMealEstimate(raw, "Meal"));
  }
});
test("unknown nutrition is retained and prompt requires reviewable quantities", () => {
  const meal = parseMealEstimate(
    response({ ...item, calories: null, protein_g: undefined }),
    "Meal",
  );
  assert.equal(meal.foods[0].nutrition.kcal, null);
  assert.equal(meal.foods[0].nutrition.protein, null);
  assert.match(generateMealPrompt('Toast "with" eggs'), /numeric quantities/);
  assert.throws(() => generateMealPrompt(" "));
  assert.throws(() => generateMealPrompt("x".repeat(501)));
});
