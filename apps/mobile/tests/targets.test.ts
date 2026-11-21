import { strict as assert } from "node:assert";
import { test } from "node:test";
import { completeProfileAnswers } from "../src/domain/fixtures";
import {
  calculateTargets,
  directionLabel,
  eer,
  estimateTargets,
  macroEnergy,
  reconciliationTolerance,
} from "../src/domain/targets";

const NOW = new Date("2026-10-28");
const base = completeProfileAnswers; // Female, 30, 165 cm, 72.5 kg, moderately active

test("DRI 2023 adult equations: every coefficient set", () => {
  // Hand-computed from the published equations (age 30, 170 cm, 70 kg).
  const cases: [string, string, number][] = [
    ["Male", "INACTIVE", 753.07 - 10.83 * 30 + 6.5 * 170 + 14.1 * 70],
    ["Male", "LOW_ACTIVE", 581.47 - 10.83 * 30 + 8.3 * 170 + 14.94 * 70],
    ["Male", "ACTIVE", 1004.82 - 10.83 * 30 + 6.52 * 170 + 15.91 * 70],
    ["Male", "VERY_ACTIVE", -517.88 - 10.83 * 30 + 15.61 * 170 + 19.11 * 70],
    ["Female", "INACTIVE", 584.9 - 7.01 * 30 + 5.72 * 170 + 11.71 * 70],
    ["Female", "LOW_ACTIVE", 575.77 - 7.01 * 30 + 6.6 * 170 + 12.14 * 70],
    ["Female", "ACTIVE", 710.25 - 7.01 * 30 + 6.54 * 170 + 12.34 * 70],
    ["Female", "VERY_ACTIVE", 511.83 - 7.01 * 30 + 9.07 * 170 + 12.56 * 70],
  ];
  for (const [set, activity, expected] of cases)
    assert.ok(
      Math.abs(eer(set as never, activity as never, 30, 170, 70) - expected) <
        1e-9,
      `${set} ${activity}`,
    );
});

test("a lose-weight profile is capped at 15% below maintenance and macros follow 18/52/30", () => {
  const out = estimateTargets(base, NOW);
  assert.equal(out.status, "OK");
  if (out.status !== "OK") return;
  const t = out.targets;
  const maintenance = eer("Female", "ACTIVE", 30, 165, 72.5);
  assert.equal(t.maintenance, Math.round(maintenance));
  assert.equal(t.direction, "lose");
  assert.equal(t.kcal, Math.round(maintenance * 0.85));
  assert.ok(out.reasons.includes("GOAL_CAPPED"));
  assert.equal(t.protein, Math.round((maintenance * 0.85 * 0.18) / 4));
  assert.equal(t.carbs, Math.round((maintenance * 0.85 * 0.52) / 4));
  assert.equal(t.fat, Math.round((maintenance * 0.85 * 0.3) / 9));
  assert.equal(t.fiber, Math.round((maintenance * 0.85 * 14) / 1000));
  assert.equal(t.formulaVersion, "DRI_EER_2023_v1");
  assert.match(directionLabel(t), /Lose/);
});

test("displayed macros reconcile to displayed kcal within tolerance", () => {
  for (const activity of [
    "Mostly sitting",
    "Lightly active",
    "Moderately active",
    "Very active",
  ]) {
    const t = calculateTargets({ ...base, activity }, NOW)!;
    assert.ok(
      Math.abs(macroEnergy(t) - t.kcal) <= reconciliationTolerance(t.kcal),
      activity,
    );
  }
});

test("the same inputs always give the same result", () => {
  assert.deepEqual(
    estimateTargets(base, NOW),
    estimateTargets({ ...base }, NOW),
  );
});

test("an exact age is required; a band alone gives a range, not a target", () => {
  const { ageYears: _omit, ...noAge } = base;
  const out = estimateTargets(noAge, NOW);
  assert.equal(out.status, "INSUFFICIENT_DATA");
  if (out.status !== "INSUFFICIENT_DATA") return;
  assert.ok(out.reasons.includes("MISSING_EXACT_AGE"));
  assert.ok(out.kcalRange && out.kcalRange.min < out.kcalRange.max);
  assert.equal(calculateTargets(noAge), null);
});

test("a missing equation set gives a range spanning both sets", () => {
  const out = estimateTargets({ ...base, sex: "Prefer not to say" }, NOW);
  assert.equal(out.status, "INSUFFICIENT_DATA");
  if (out.status !== "INSUFFICIENT_DATA") return;
  assert.ok(out.reasons.includes("MISSING_EQUATION_SET"));
  const f = eer("Female", "ACTIVE", 30, 165, 72.5);
  const m = eer("Male", "ACTIVE", 30, 165, 72.5);
  assert.deepEqual(out.kcalRange, {
    min: Math.round(Math.min(f, m)),
    max: Math.round(Math.max(f, m)),
  });
});

test("no single target and no range for an open-ended age band", () => {
  const { ageYears: _omit, ...noAge } = base;
  const out = estimateTargets({ ...noAge, age: "65 or older" }, NOW);
  assert.equal(out.status, "INSUFFICIENT_DATA");
  if (out.status === "INSUFFICIENT_DATA") assert.equal(out.kcalRange, null);
});

test("under 19 is out of scope, including exactly 18", () => {
  for (const patch of [
    { age: "Under 18" },
    { ageYears: "18" },
    { ageYears: "12" },
  ])
    assert.equal(
      estimateTargets({ ...base, ...patch }, NOW).status,
      "OUT_OF_SCOPE",
    );
  assert.equal(estimateTargets({ ...base, ageYears: "19" }, NOW).status, "OK");
});

test("matching current and target weight is maintenance", () => {
  const t = calculateTargets({ ...base, targetWeightKg: "72.5" })!;
  assert.equal(t.direction, "maintain");
  assert.equal(t.weeklyChangeKg, 0);
  assert.equal(t.weeksToGoal, null);
  assert.equal(t.kcal, t.maintenance);
});

test("a goal weight in the other direction is a gain with a surplus", () => {
  const t = calculateTargets({
    ...base,
    targetWeightKg: "78",
    weeklyPace: "Gentle · 0.25 kg a week",
  })!;
  assert.equal(t.direction, "gain");
  assert.ok(t.kcal > t.maintenance);
});

test("BMI below 18.5 never gets a deficit", () => {
  const out = estimateTargets(
    { ...base, currentWeightKg: "45", targetWeightKg: "40" },
    NOW,
  );
  assert.equal(out.status, "OK");
  if (out.status !== "OK") return;
  assert.equal(out.targets.direction, "maintain");
  assert.ok(out.reasons.includes("GOAL_BLOCKED_BMI"));
  assert.equal(out.targets.kcal, out.targets.maintenance);
});

test("a clinician-defined nutrient blocks weight-change targets", () => {
  const out = estimateTargets(base, NOW, { blockWeightGoal: true });
  assert.equal(out.status, "OK");
  if (out.status !== "OK") return;
  assert.equal(out.targets.direction, "maintain");
  assert.ok(out.reasons.includes("GOAL_BLOCKED_CLINICIAN_DEFINED"));
});

test("varying activity uses low active and says so", () => {
  const out = estimateTargets({ ...base, activity: "Varies day to day" }, NOW);
  assert.equal(out.status, "OK");
  if (out.status !== "OK") return;
  assert.ok(out.reasons.includes("ACTIVITY_UNCERTAIN"));
  assert.equal(
    out.targets.maintenance,
    Math.round(eer("Female", "LOW_ACTIVE", 30, 165, 72.5)),
  );
});

test("missing or implausible body stats return no target", () => {
  assert.equal(calculateTargets({ age: "25–34" }), null);
  assert.equal(calculateTargets({ ...base, heightCm: "90" }), null);
  for (const heightCm of ["", "0", "-5", "abc", "NaN"]) {
    const out = estimateTargets({ ...base, heightCm }, NOW);
    assert.equal(out.status, "INSUFFICIENT_DATA", heightCm);
    assert.ok(
      out.status === "INSUFFICIENT_DATA" &&
        out.reasons.includes("MISSING_BODY_STATS"),
    );
  }
  for (const currentWeightKg of ["", "0", "-3", "text"]) {
    const out = estimateTargets({ ...base, currentWeightKg }, NOW);
    assert.equal(out.status, "INSUFFICIENT_DATA", currentWeightKg);
  }
  const missingHeight = estimateTargets({ ...base, heightCm: "" }, NOW);
  const missingWeight = estimateTargets({ ...base, currentWeightKg: "" }, NOW);
  assert.equal(missingHeight.status, "INSUFFICIENT_DATA");
  assert.equal(missingWeight.status, "INSUFFICIENT_DATA");
  assert.equal(calculateTargets({ ...base, heightCm: "" }), null);
  assert.equal(calculateTargets({ ...base, currentWeightKg: "" }), null);
});

test("changing current or target weight recalculates energy", () => {
  const lighter = calculateTargets({ ...base, currentWeightKg: "70" }, NOW)!;
  const heavier = calculateTargets({ ...base, currentWeightKg: "80" }, NOW)!;
  assert.ok(heavier.maintenance > lighter.maintenance);
  assert.notEqual(heavier.kcal, lighter.kcal);
  const maintain = calculateTargets(
    { ...base, targetWeightKg: base.currentWeightKg },
    NOW,
  )!;
  const gain = calculateTargets(
    { ...base, targetWeightKg: "80", weeklyPace: "Gentle · 0.25 kg a week" },
    NOW,
  )!;
  assert.equal(maintain.direction, "maintain");
  assert.equal(maintain.kcal, maintain.maintenance);
  assert.equal(gain.direction, "gain");
  assert.ok(gain.kcal > gain.maintenance);
});

test("guide fixture: female 30, 155 cm, 50 kg, inactive, maintain displays 1847 kcal", () => {
  const maintenance = eer("Female", "INACTIVE", 30, 155, 50);
  assert.ok(Math.abs(maintenance - 1846.7) < 0.05);
  const t = calculateTargets(
    {
      ...base,
      sex: "Female",
      ageYears: "30",
      heightCm: "155",
      currentWeightKg: "50",
      targetWeightKg: "50",
      activity: "Mostly sitting",
    },
    NOW,
  )!;
  assert.equal(t.kcal, 1847);
  assert.equal(t.direction, "maintain");
  assert.equal(t.protein, Math.round((maintenance * 0.18) / 4));
  assert.equal(t.fat, Math.round((maintenance * 0.3) / 9));
  assert.equal(t.fiber, Math.round((maintenance * 14) / 1000));
});
