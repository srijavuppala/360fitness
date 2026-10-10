import assert from "node:assert/strict";
import { test } from "node:test";
import { parseMealPhoto, mealPhotoDraft } from "../src/domain/meal-photo";
import { initialState } from "../src/domain/fixtures";
import {
  recordMeal,
  scaleFood,
  sumNutrition,
  parseSavedState,
} from "../src/domain/meals";
import { createPhotoReader } from "../src/services/label-reader";
const food = {
  name: "Rice",
  quantity: 1,
  unit: "cup",
  portionNote: "Visual estimate with no scale reference",
  uncertain: true,
  nutrition: { kcal: 200, protein: 4, carbs: 44, fat: null },
};
const result = {
  status: "food",
  name: "Rice plate",
  foods: [
    food,
    {
      ...food,
      name: "Vegetables",
      nutrition: { kcal: 50, protein: 2, carbs: 10, fat: null },
    },
  ],
};
const image = { mimeType: "image/jpeg" as const, base64: "/9j/2Q==" };
const connection = async () => ({
  url: "https://test.invalid/analyzeMealPhotoCallable",
  headers: { Authorization: "Bearer fixture" },
});

test("meal photo suggestions become independent AI drafts and never log themselves", () => {
  const state = initialState();
  const draft = mealPhotoDraft(parseMealPhoto(result));
  assert.equal(state.entries.length, 0);
  assert.equal(draft.foods.length, 2);
  assert.equal(draft.foods[0].source, "ai");
  assert.match(draft.foods[0].estimateNote!, /Uncertain/);
  const half = {
    ...draft,
    foods: draft.foods.map((food) => scaleFood(food, 0.5)),
  };
  assert.equal(sumNutrition(half.foods).kcal, 125);
  assert.equal(sumNutrition(half.foods).fat, null);
  const saved = recordMeal(
    recordMeal(state, half, "2026-10-08", "confirmed"),
    half,
    "2026-10-08",
    "confirmed",
  );
  assert.equal(saved.entries.length, 1);
  assert.deepEqual(parseSavedState(JSON.stringify(saved)), saved);
  assert.equal(draft.foods[0].nutrition.kcal, 200);
});
test("unknown portion creates a clearly described relative placeholder, never invented grams or nutrition", () => {
  const parsed = parseMealPhoto({
    ...result,
    foods: [{ ...food, quantity: null, unit: null }],
  });
  const item = mealPhotoDraft(parsed).foods[0];
  assert.equal(item.quantity, 1);
  assert.equal(item.unit, "pictured portion");
  assert.match(item.estimateNote!, /placeholder/);
  assert.deepEqual(item.nutrition, {
    kcal: null,
    protein: null,
    carbs: null,
    fat: null,
  });
});
test("no food, unclear and malformed output cannot create loggable food drafts", () => {
  for (const status of ["no_food", "unclear"]) {
    assert.throws(() =>
      mealPhotoDraft(parseMealPhoto({ status, name: "", foods: [] })),
    );
    assert.throws(() => parseMealPhoto({ ...result, status }));
  }
  for (const value of [
    null,
    {},
    { ...result, foods: [] },
    { ...result, foods: Array(13).fill(food) },
    { ...result, foods: [{ ...food, uncertain: "yes" }] },
    {
      ...result,
      foods: [{ ...food, nutrition: { ...food.nutrition, kcal: "200" } }],
    },
    { ...result, foods: [{ ...food, nutrition: {} }] },
  ])
    assert.throws(() => parseMealPhoto(value));
});
test("meal transport sends only the photo and parses the dedicated result", async () => {
  let calls = 0;
  const read = createPhotoReader(
    async (url, init) => {
      calls++;
      assert.equal(url, "https://test.invalid/analyzeMealPhotoCallable");
      assert.deepEqual(JSON.parse(init!.body as string), { data: image });
      return new Response(JSON.stringify({ result }));
    },
    connection,
    parseMealPhoto,
    40000,
    "meal",
  );
  assert.equal((await read(image)).foods.length, 2);
  assert.equal(calls, 1);
});
test("meal errors and late credential cancellation never turn into a success fallback", async () => {
  await assert.rejects(
    () =>
      createPhotoReader(
        async () =>
          new Response(JSON.stringify({ error: { status: "DATA_LOSS" } }), {
            status: 400,
          }),
        connection,
        parseMealPhoto,
        40000,
        "meal",
      )(image),
    /meal could not be recognized/,
  );
  let sent = 0;
  const controller = new AbortController();
  const request = createPhotoReader(
    async () => {
      sent++;
      return new Response();
    },
    () => new Promise(() => {}),
    parseMealPhoto,
    40000,
    "meal",
  )(image, controller.signal);
  controller.abort();
  await assert.rejects(() => request, /cancelled/);
  assert.equal(sent, 0);
});
