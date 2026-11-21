import { strict as assert } from "node:assert";
import { test } from "node:test";
import { completeProfileAnswers } from "../src/domain/fixtures";
import {
  draftFromHealth,
  HealthDraft,
  healthFromDraft,
  HealthProfile,
} from "../src/domain/health";
import {
  evaluateHealthContext,
  mergeConditionRules,
} from "../src/domain/health-context";
import {
  buildNutritionGoal,
  calorieRing,
  NUTRITION_GOAL_VERSION,
  shownValue,
} from "../src/domain/nutrition-goal";
import { calculateTargets } from "../src/domain/targets";

const NOW = new Date("2026-11-17T10:00:00.000Z");
const KIDNEY = "Kidney-related condition";
const health = (patch: Partial<HealthDraft>): HealthProfile =>
  healthFromDraft({ ...draftFromHealth(undefined), ...patch }, undefined, NOW);
const goalFor = (h?: HealthProfile, answers = completeProfileAnswers) =>
  buildNutritionGoal(answers, h, NOW);
const keys = ["kcal", "protein", "carbs", "fat", "fiber"] as const;
// A kidney profile blocks weight-change goals, so compare against maintenance.
const general = calculateTargets(completeProfileAnswers, NOW)!;
const kidneyGeneral = calculateTargets(completeProfileAnswers, NOW, {
  blockWeightGoal: true,
})!;

test("no health answers: a general estimate, labelled as not accounting for health", () => {
  const goal = goalFor(undefined);
  assert.equal(goal.status, "GENERAL_ESTIMATE");
  assert.equal(goal.assessment, "NOT_ASSESSED");
  assert.deepEqual(goal.generalTarget, general);
  assert.ok(goal.notices.includes("unknown"));
  assert.equal(goal.calculationVersion, NUTRITION_GOAL_VERSION);
  assert.equal(goal.calculatedAt, NOW.toISOString());
  for (const key of keys) assert.equal(shownValue(goal, key), general[key]);
});

test("a user who reported no conditions keeps the general estimate", () => {
  const goal = goalFor(health({ conditions: ["None of the above"] }));
  assert.equal(goal.status, "GENERAL_ESTIMATE");
  assert.deepEqual(goal.withheld, []);
  assert.equal(goal.requiresProfessionalReview, false);
});

test("kidney condition: protein shows the general estimate, flagged for review", () => {
  const goal = goalFor(health({ conditions: [KIDNEY] }));
  assert.equal(goal.status, "CLINICIAN_DEFINED");
  assert.deepEqual(goal.withheld, []);
  assert.deepEqual(goal.flagged, ["protein"]);
  assert.equal(goal.displayedTarget.protein?.flagged, true);
  assert.equal(shownValue(goal, "protein"), kidneyGeneral.protein);
  assert.ok(goal.notices.includes("kidney-dialysis-unknown"));
  assert.ok(goal.reasons.includes("CLINICIAN_TARGET_REQUIRED"));
  assert.equal(goal.requiresProfessionalReview, true);
  // Unaffected nutrients still come from the unchanged calculation.
  for (const key of ["kcal", "carbs", "fat", "fiber"] as const)
    assert.equal(shownValue(goal, key), kidneyGeneral[key]);
  // Weight-change targets are not estimated while protein is clinician-defined.
  assert.equal(goal.generalTarget?.direction, "maintain");
});

test("kidney condition with dialysis status: still flagged, value never altered", () => {
  for (const kidneyDialysis of ["On dialysis", "Not on dialysis"] as const) {
    const goal = goalFor(health({ conditions: [KIDNEY], kidneyDialysis }));
    assert.equal(shownValue(goal, "protein"), kidneyGeneral.protein);
    assert.equal(goal.displayedTarget.protein?.flagged, true);
    assert.ok(!goal.notices.includes("kidney-dialysis-unknown"));
    assert.ok(goal.notices.includes("kidney"));
  }
});

test("diabetes alone flags carbohydrates but leaves protein untouched", () => {
  const goal = goalFor(health({ conditions: ["Diabetes (Type 1 / Type 2)"] }));
  assert.equal(goal.status, "CONDITION_SENSITIVE");
  assert.deepEqual(goal.flagged, ["carbs"]);
  assert.equal(shownValue(goal, "protein"), general.protein);
  assert.equal(goal.displayedTarget.carbs?.flagged, true);
  assert.deepEqual(goal.withheld, []);
});

test("no displayed value is ever anything but the general estimate or a clinician value", () => {
  const lists = [
    [KIDNEY],
    [KIDNEY, "Diabetes (Type 1 / Type 2)"],
    ["Heart-related condition"],
  ];
  for (const conditions of lists) {
    const goal = goalFor(health({ conditions: conditions as never }));
    for (const key of keys) {
      const shown = goal.displayedTarget[key];
      if (shown && goal.generalTarget)
        assert.equal(shown.value, goal.generalTarget[key]);
    }
  }
});

test("a clinician protein target is shown as theirs, with who gave it", () => {
  const goal = goalFor(
    health({
      conditions: [KIDNEY],
      clinicianProtein: "52",
      clinicianSource: "Dr Rao",
    }),
  );
  assert.equal(goal.status, "CLINICIAN_DEFINED");
  assert.equal(goal.source, "CLINICIAN_PROVIDED");
  assert.deepEqual(goal.displayedTarget.protein, {
    value: 52,
    source: "CLINICIAN_PROVIDED",
    flagged: false,
    providedBy: "Dr Rao",
  });
  assert.equal(goal.requiresProfessionalReview, false);
});

test("an expired clinician target is ignored and the flagged estimate is shown again", () => {
  const goal = goalFor(
    health({
      conditions: [KIDNEY],
      clinicianProtein: "52",
      clinicianSource: "Dr Rao",
      clinicianReviewBy: "2026-01-01",
    }),
  );
  assert.equal(goal.displayedTarget.protein?.source, "APP_ESTIMATE");
  assert.equal(goal.displayedTarget.protein?.flagged, true);
  assert.ok(goal.reasons.includes("CLINICIAN_TARGET_EXPIRED"));
  assert.ok(goal.notices.includes("expired"));
});

test("removing kidney from the answers removes the clinician value and the block", () => {
  const before = health({
    conditions: [KIDNEY],
    clinicianProtein: "52",
    clinicianSource: "Dr Rao",
  });
  const after = healthFromDraft(
    { ...draftFromHealth(before), conditions: ["None of the above"] },
    before,
    NOW,
  );
  const goal = goalFor(after);
  assert.equal(goal.status, "GENERAL_ESTIMATE");
  assert.equal(shownValue(goal, "protein"), general.protein);
});

test("pregnancy and breastfeeding are out of scope with no numbers", () => {
  for (const lifeStage of ["Pregnant", "Breastfeeding"] as const) {
    const goal = goalFor(
      health({ conditions: ["None of the above"], lifeStage }),
    );
    assert.equal(goal.status, "OUT_OF_SCOPE");
    assert.equal(goal.generalTarget, null);
    for (const key of keys) assert.equal(goal.displayedTarget[key], null);
    assert.ok(goal.reasons.includes("LIFE_STAGE_PATH_REQUIRED"));
  }
});

test("under 19 is out of scope", () => {
  const goal = goalFor(undefined, {
    ...completeProfileAnswers,
    ageYears: "17",
  });
  assert.equal(goal.status, "OUT_OF_SCOPE");
  assert.equal(goal.generalTarget, null);
});

test("an incomplete profile fails closed with a reason, not a guess", () => {
  const { ageYears: _omit, ...noAge } = completeProfileAnswers;
  const goal = goalFor(undefined, noAge);
  assert.equal(goal.status, "INSUFFICIENT_DATA");
  assert.equal(goal.generalTarget, null);
  assert.ok(goal.reasons.includes("MISSING_EXACT_AGE"));
  assert.ok(goal.kcalRange);
  for (const key of keys) assert.equal(goal.displayedTarget[key], null);
  assert.equal(
    buildNutritionGoal({}, undefined, NOW).status,
    "INSUFFICIENT_DATA",
  );
});

test("professional dietary advice is an advisory, not a change to numbers", () => {
  const goal = goalFor(
    health({ conditions: ["None of the above"], professionalGuidance: "Yes" }),
  );
  assert.equal(goal.status, "CONDITION_SENSITIVE");
  assert.ok(goal.notices.includes("guidance"));
  assert.equal(shownValue(goal, "protein"), general.protein);
});

test("changing health information changes the recalculated outcome", () => {
  const a = goalFor(health({ conditions: ["None of the above"] }));
  const b = goalFor(health({ conditions: [KIDNEY] }));
  assert.notEqual(a.status, b.status);
});

test("the context evaluator holds no numbers: it only reports impact", () => {
  const context = evaluateHealthContext(health({ conditions: [KIDNEY] }), NOW);
  assert.deepEqual(context.clinicianDefined, ["protein"]);
  assert.equal(context.impact.kcal, "UNAFFECTED");
  assert.equal(
    evaluateHealthContext(undefined, NOW).assessment,
    "NOT_ASSESSED",
  );
});

test("prefer not to disclose keeps the general estimate", () => {
  const goal = goalFor(health({ conditions: ["Prefer not to disclose"] }));
  assert.equal(goal.status, "GENERAL_ESTIMATE");
  assert.deepEqual(goal.selectedConditions, []);
  assert.deepEqual(goal.flagged, []);
  for (const key of keys) assert.equal(shownValue(goal, key), general[key]);
});

test("conditions without a numeric rule keep every general target", () => {
  for (const condition of [
    "High blood pressure (Hypertension)",
    "Liver-related condition",
    "Thyroid-related condition",
    "Heart-related condition",
    "Other health condition",
  ] as const) {
    const goal = goalFor(health({ conditions: [condition] }));
    assert.equal(goal.status, "CONDITION_SENSITIVE", condition);
    assert.deepEqual(goal.selectedConditions, [condition]);
    assert.deepEqual(goal.flagged, [], condition);
    assert.deepEqual(goal.conflicts, []);
    for (const key of keys)
      assert.equal(shownValue(goal, key), general[key], condition);
    assert.equal(goal.generalTarget?.direction, "lose");
  }
});

test("diabetes plus kidney flags both nutrients and does not average them", () => {
  const goal = goalFor(
    health({
      conditions: [KIDNEY, "Diabetes (Type 1 / Type 2)"],
    }),
  );
  assert.equal(goal.status, "CLINICIAN_DEFINED");
  assert.deepEqual(goal.conflicts, []);
  assert.equal(goal.displayedTarget.protein?.flagged, true);
  assert.equal(goal.displayedTarget.carbs?.flagged, true);
  assert.equal(shownValue(goal, "protein"), kidneyGeneral.protein);
  assert.equal(shownValue(goal, "carbs"), kidneyGeneral.carbs);
  assert.notEqual(shownValue(goal, "carbs"), general.carbs);
});

test("disagreeing rules are a conflict and do not invent a third number", () => {
  const merged = mergeConditionRules([
    { impacts: { protein: "CONDITION_SENSITIVE" }, notice: "sensitive" },
    { impacts: { protein: "CLINICIAN_DEFINED" }, notice: "kidney" },
  ]);
  assert.deepEqual(merged.conflicts, ["protein"]);
  assert.equal(merged.impact.protein, "CLINICIAN_DEFINED");
  assert.equal(merged.impact.carbs, "UNAFFECTED");
});

test("the ring uses the evaluated calorie target, including after a condition changes it", () => {
  const plain = goalFor(undefined);
  const kidney = goalFor(health({ conditions: [KIDNEY] }));
  const plainKcal = shownValue(plain, "kcal")!;
  const kidneyKcal = shownValue(kidney, "kcal")!;
  assert.notEqual(plainKcal, kidneyKcal);
  const eaten = 500;
  const progress = calorieRing(eaten, kidneyKcal);
  assert.deepEqual(progress, {
    eaten,
    target: kidneyKcal,
    percent: Math.round((eaten / kidneyKcal) * 100),
    remaining: kidneyKcal - eaten,
  });
  assert.equal(calorieRing(null, null), null);
  assert.equal(calorieRing(0, plainKcal)?.percent, 0);
});

test("skipping health leaves the same targets as a profile with no health data", () => {
  const skipped = goalFor(undefined);
  assert.equal(skipped.status, "GENERAL_ESTIMATE");
  assert.equal(shownValue(skipped, "kcal"), general.kcal);
  assert.equal(shownValue(skipped, "fiber"), general.fiber);
});
