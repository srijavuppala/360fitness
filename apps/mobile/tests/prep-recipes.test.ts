import { strict as assert } from "node:assert";
import { test } from "node:test";
import { prepRecipes, batchFromRecipe } from "../src/domain/prep-recipes";
import {
  advancePrepStep,
  groceryList,
  saveBatch,
  validatePrepBatch,
} from "../src/domain/meal-prep";
import { initialState } from "../src/domain/fixtures";
import { parseSavedState, sumNutrition } from "../src/domain/meals";
import { parseCloudPrep } from "../src/services/cloud/prep-repository";

test("every starter is bounded, editable, independently copied and keeps unknown nutrition", () => {
  assert.equal(
    new Set(prepRecipes.map((recipe) => recipe.id)).size,
    prepRecipes.length,
  );
  for (const recipe of prepRecipes) {
    const batch = batchFromRecipe(recipe, "2026-10-08", 4);
    validatePrepBatch(batch);
    assert.equal(batch.guide!.steps.length, 4);
    assert.equal(sumNutrition(batch.meal.foods).kcal, null);
    const another = batchFromRecipe(recipe, "2026-10-09", 1);
    batch.meal.foods[0].quantity = 999;
    batch.guide!.steps[1] = "Edited";
    assert.notEqual(another.meal.foods[0].quantity, 999);
    assert.notEqual(another.guide!.steps[1], "Edited");
  }
});

test("starter groceries use the full batch while progress preserves shopping checks and intake", () => {
  const batch = batchFromRecipe(prepRecipes[0], "2026-10-08", 4);
  let state = saveBatch(initialState(), batch);
  const groceries = groceryList(state.mealPrep!, batch.date);
  assert.equal(
    groceries.find((item) => item.name === "Pasteurized plain Greek yogurt")!
      .quantity,
    680,
  );
  state.mealPrep!.checked = [groceries[0].key];
  state = advancePrepStep(state, batch.id, 0);
  state = advancePrepStep(state, batch.id, 0);
  assert.equal(state.mealPrep!.batches[0].guide!.completed, 1);
  assert.equal(state.mealPrep!.checked.length, 1);
  for (let step = 1; step < 4; step++)
    state = advancePrepStep(state, batch.id, step);
  assert.strictEqual(advancePrepStep(state, batch.id, 4), state);
  assert.equal(state.mealPrep!.batches[0].prepared, false);
  assert.equal(state.entries.length, 0);
});

test("step progress round trips through local storage and a validated cloud backup", () => {
  const batch = batchFromRecipe(prepRecipes[3], "2026-10-08", 2);
  const state = advancePrepStep(saveBatch(initialState(), batch), batch.id, 0);
  assert.deepEqual(parseSavedState(JSON.stringify(state)), state);
  const remote = parseCloudPrep({
    schemaVersion: 1,
    revision: 1,
    generation: "a".repeat(20),
    payload: JSON.stringify(state.mealPrep),
  });
  assert.equal(remote.plan.batches[0].guide!.completed, 1);
});

test("corrupt cloud or local guides cannot inject oversized or invalid progress", () => {
  const batch = batchFromRecipe(prepRecipes[0], "2026-10-08", 1);
  for (const guide of [
    null,
    {},
    { steps: [], completed: 0 },
    { steps: ["ok"], completed: -1 },
    { steps: ["ok"], completed: 2 },
    { steps: ["ok"], completed: 0.5 },
    { steps: ["x".repeat(601)], completed: 0 },
    { steps: Array(9).fill("ok"), completed: 0 },
  ]) {
    assert.throws(() =>
      parseSavedState(
        JSON.stringify({
          ...initialState(),
          mealPrep: { version: 1, batches: [{ ...batch, guide }], checked: [] },
        }),
      ),
    );
  }
});
