import { strict as assert } from "node:assert";
import { test } from "node:test";
import { completeProfileAnswers } from "../src/domain/fixtures";
import { calculateTargets, directionLabel } from "../src/domain/targets";

test("a typical lose-weight profile produces a deficit below maintenance", () => {
  const targets = calculateTargets(completeProfileAnswers, new Date("2026-10-28"));
  assert.ok(targets);
  assert.equal(targets.direction, "lose");
  assert.ok(targets.kcal < targets.maintenance);
  assert.ok(targets.kcal >= 1200);
  assert.equal(targets.protein, Math.round(1.6 * 68));
  assert.equal(targets.fat, Math.round((targets.kcal * 0.3) / 9));
  assert.equal(
    targets.carbs,
    Math.max(0, Math.round((targets.kcal - targets.protein * 4 - targets.fat * 9) / 4)),
  );
  assert.equal(targets.weeksToGoal, 9);
  assert.equal(targets.goalDate, "2026-12-30");
  assert.match(directionLabel(targets), /Lose/);
});

test("matching current and target weight is maintenance", () => {
  const targets = calculateTargets({
    ...completeProfileAnswers,
    targetWeightKg: "72.5",
  });
  assert.ok(targets);
  assert.equal(targets.direction, "maintain");
  assert.equal(targets.weeklyChangeKg, 0);
  assert.equal(targets.weeksToGoal, null);
  assert.equal(Math.abs(targets.dailyAdjustment) < 20, true);
});

test("under 18 is forced to maintenance with a doctor note", () => {
  const targets = calculateTargets({
    ...completeProfileAnswers,
    age: "Under 18",
    currentWeightKg: "60",
    targetWeightKg: "55",
  });
  assert.ok(targets);
  assert.equal(targets.direction, "maintain");
  assert.ok(targets.notes.some((note) => /doctor/i.test(note)));
});

test("missing body stats returns null instead of inventing a target", () => {
  assert.equal(calculateTargets({ age: "25–34" }), null);
  assert.equal(
    calculateTargets({
      ...completeProfileAnswers,
      heightCm: "90",
    }),
    null,
  );
});

test("calorie floor is applied and explained", () => {
  const targets = calculateTargets({
    ...completeProfileAnswers,
    sex: "Female",
    currentWeightKg: "48",
    targetWeightKg: "40",
    weeklyPace: "Faster · 0.75 kg a week",
    activity: "Mostly sitting",
  });
  assert.ok(targets);
  assert.ok(targets.kcal >= 1200);
  assert.ok(targets.notes.some((note) => /safe minimum/i.test(note)));
});
