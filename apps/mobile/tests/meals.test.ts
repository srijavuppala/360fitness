import { strict as assert } from "node:assert";
import { test } from "node:test";
import { initialState, sampleMeals } from "../src/domain/fixtures";
import {
  dailyNutrition,
  lastDays,
  localDate,
  parseSavedState,
  recordMeal,
  scaleFood,
  sumNutrition,
  validateMeal,
} from "../src/domain/meals";

test("a usual plan alone contributes no confirmed nutrition", () => {
  assert.equal(dailyNutrition(initialState().entries, "2026-10-05").kcal, 0);
});
test("confirming the same meal twice replaces it rather than double-counting", () => {
  let state = recordMeal(
    initialState(),
    sampleMeals[0],
    "2026-10-05",
    "confirmed",
  );
  state = recordMeal(state, sampleMeals[0], "2026-10-05", "confirmed");
  assert.equal(state.entries.length, 1);
  assert.equal(dailyNutrition(state.entries, "2026-10-05").kcal, 300);
});
test("a changed portion scales each item once and replaces confirmed nutrition", () => {
  let state = recordMeal(
    initialState(),
    sampleMeals[0],
    "2026-10-05",
    "confirmed",
  );
  const half = {
    ...sampleMeals[0],
    foods: sampleMeals[0].foods.map((food) =>
      scaleFood(food, food.quantity / 2),
    ),
  };
  state = recordMeal(state, half, "2026-10-05", "confirmed");
  assert.equal(dailyNutrition(state.entries, "2026-10-05").kcal, 150);
  assert.equal(sumNutrition(state.templates[0].foods).kcal, 300);
});
test("skipping a confirmed meal removes its contribution but retains a check-in", () => {
  let state = recordMeal(
    initialState(),
    sampleMeals[0],
    "2026-10-05",
    "confirmed",
  );
  state = recordMeal(state, sampleMeals[0], "2026-10-05", "skipped");
  assert.equal(state.entries.length, 1);
  assert.equal(state.entries[0].status, "skipped");
  assert.equal(dailyNutrition(state.entries, "2026-10-05").kcal, 0);
});
test("editing templates cannot mutate historical snapshots", () => {
  const state = initialState();
  const logged = recordMeal(
    state,
    state.templates[0],
    "2026-10-05",
    "confirmed",
  );
  state.templates[0].foods[0].nutrition.kcal = 999;
  state.templates[0].name = "Different breakfast";
  assert.equal(dailyNutrition(logged.entries, "2026-10-05").kcal, 300);
  assert.equal(logged.entries[0].name, sampleMeals[0].name);
});
test("an unknown nutrient stays unknown across scaling and totaling", () => {
  const food = {
    ...sampleMeals[0].foods[0],
    nutrition: { ...sampleMeals[0].foods[0].nutrition, protein: null },
  };
  const scaled = scaleFood(food, 20);
  assert.equal(scaled.nutrition.protein, null);
  assert.equal(sumNutrition([scaled, sampleMeals[0].foods[1]]).protein, null);
  assert.equal(scaled.nutrition.kcal, 75);
});
test("different meals and dates do not overwrite one another", () => {
  let state = recordMeal(
    initialState(),
    sampleMeals[0],
    "2026-10-05",
    "confirmed",
  );
  state = recordMeal(state, sampleMeals[1], "2026-10-05", "confirmed");
  state = recordMeal(state, sampleMeals[0], "2026-10-06", "confirmed");
  assert.equal(state.entries.length, 3);
  assert.equal(dailyNutrition(state.entries, "2026-10-05").kcal, 760);
  assert.equal(dailyNutrition(state.entries, "2026-10-06").kcal, 300);
});
test("invalid manual amounts and nutrient values cannot be saved", () => {
  for (const quantity of [0, -1, NaN, Infinity, 10001])
    assert.throws(() => scaleFood(sampleMeals[0].foods[0], quantity));
  const meal = structuredClone(sampleMeals[0]);
  meal.foods[0].nutrition.kcal = -1;
  assert.throws(() => validateMeal(meal));
  assert.throws(() => validateMeal({ ...meal, foods: [] }));
});
test("saved state round-trips without seeding fake history", () => {
  const state = recordMeal(
    initialState(),
    sampleMeals[0],
    "2026-10-05",
    "confirmed",
  );
  assert.deepEqual(parseSavedState(JSON.stringify(state)), state);
  assert.equal(initialState().entries.length, 0);
  assert.throws(() => parseSavedState('{"version":99}'));
});
test("local dates and seven-day history cross a month boundary", () => {
  assert.equal(localDate(new Date(2026, 9, 1, 23, 59)), "2026-10-01");
  assert.deepEqual(lastDays(3, new Date(2026, 9, 1, 0, 5)), [
    "2026-09-29",
    "2026-09-30",
    "2026-10-01",
  ]);
});
