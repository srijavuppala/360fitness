import assert from "node:assert/strict";
import { test } from "node:test";
import {
  emptyLabel,
  labelMeal,
  labelNutrition,
  labelPortion,
  readLabelText,
} from "../src/domain/label-entry";
import { initialState } from "../src/domain/fixtures";
import { parseSavedState, recordMeal, scaleFood } from "../src/domain/meals";

const fields = { kcal: "200", protein: "6", carbs: "24", fat: "8" };
test("label portions distinguish per 100 g, per 100 ml and printed servings", () => {
  const grams = labelPortion(fields, "kcal", "100g", "30");
  assert.equal(grams.kcal, 60);
  assert.ok(Math.abs(grams.protein! - 1.8) < 0.000001);
  assert.ok(Math.abs(grams.carbs! - 7.2) < 0.000001);
  assert.ok(Math.abs(grams.fat! - 2.4) < 0.000001);
  assert.equal(labelPortion(fields, "kcal", "100ml", "250").kcal, 500);
  assert.equal(labelPortion(fields, "kcal", "serving", "1.5").kcal, 300);
});
test("kJ converts once and missing nutrition never becomes zero", () => {
  const nutrition = labelNutrition(
    { ...emptyLabel, kcal: "418.4", fat: "0" },
    "kJ",
  );
  assert.ok(Math.abs(nutrition.kcal! - 100) < 0.00001);
  assert.equal(nutrition.fat, 0);
  assert.equal(nutrition.protein, null);
  assert.equal(
    labelPortion({ ...emptyLabel, fat: "0" }, "kcal", "100g", "30").kcal,
    null,
  );
});
test("invalid numbers and oversized portions are rejected without silent coercion", () => {
  for (const kcal of [
    "-1",
    "1e3",
    "1,000",
    "NaN",
    "Infinity",
    "4kcal",
    "10001",
    "<1",
  ])
    assert.throws(() => labelNutrition({ ...fields, kcal }, "kcal"));
  for (const portion of ["", "0", "-2", "Infinity", "10001"])
    assert.throws(() => labelPortion(fields, "kcal", "100g", portion));
  assert.throws(() => labelPortion(fields, "kcal", "serving", "101"));
  assert.throws(() => labelPortion(fields, "kcal", "serving", "100"), /limits/);
  assert.throws(
    () => labelPortion(emptyLabel, "kcal", "serving", "1"),
    /at least one/,
  );
});
test("single-column label import ignores daily percentages, sugars and saturated fat", () => {
  const result = readLabelText(
    "Nutrition Facts\nCalories 200\nTotal Fat 8g 10%\nSaturated Fat 2g 10%\nTotal Carbohydrate 24 g 9%\nSugars 12 g\nProtein 6g",
  );
  assert.deepEqual(result, { fields, energyUnit: "kcal", found: 4 });
  assert.equal(readLabelText("Energy 418.4 kJ\nProtein 0 g").energyUnit, "kJ");
});
test("ambiguous multi-column and unread values are never guessed", () => {
  assert.throws(
    () => readLabelText("Calories 200\nCalories 600\nProtein 6g"),
    /one nutrition column/,
  );
  assert.throws(
    () => readLabelText("Calories 200 600\nTotal Fat 8g 24g"),
    /unambiguous/,
  );
  assert.throws(() => readLabelText("Energy 200"), /unambiguous/);
  assert.throws(() => readLabelText("Protein <1g\nProtein 12%"), /unambiguous/);
  assert.throws(() => readLabelText("a".repeat(6001)), /6,000/);
  const result = readLabelText("Calories 0\nProtein <1g\nTotal Fat 1,5g");
  assert.equal(result.fields.kcal, "0");
  assert.equal(result.fields.protein, "");
  assert.equal(result.fields.fat, "");
});
test("review requires confirmation, creates manual draft and persists only nutrition, never photo data", () => {
  const input = {
    name: "Granola",
    fields,
    energyUnit: "kcal" as const,
    basis: "serving" as const,
    portion: "1.5",
    checked: true,
  };
  assert.throws(() => labelMeal({ ...input, checked: false }), /Check/);
  assert.throws(() => labelMeal({ ...input, name: " " }), /name/);
  const draft = labelMeal(input);
  const state = initialState();
  assert.equal(state.entries.length, 0);
  assert.equal(draft.foods[0].source, "manual");
  assert.equal(draft.foods[0].nutrition.kcal, 300);
  assert.equal(scaleFood(draft.foods[0], 3).nutrition.kcal, 600);
  const saved = parseSavedState(
    JSON.stringify(recordMeal(state, draft, "2026-10-07", "confirmed")),
  );
  assert.equal(saved.entries[0].foods[0].nutrition.protein, 9);
  assert.deepEqual(Object.keys(saved.entries[0].foods[0]).sort(), [
    "id",
    "name",
    "nutrition",
    "quantity",
    "source",
    "unit",
  ]);
});
