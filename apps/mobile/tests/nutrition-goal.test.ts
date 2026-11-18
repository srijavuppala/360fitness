import { strict as assert } from "node:assert";
import { test } from "node:test";
import { completeProfileAnswers } from "../src/domain/fixtures";
import {
  draftFromHealth,
  HealthDraft,
  healthFromDraft,
  HealthProfile,
} from "../src/domain/health";
import { evaluateHealthContext } from "../src/domain/health-context";
import {
  buildNutritionGoal,
  NUTRITION_GOAL_VERSION,
  shownValue,
} from "../src/domain/nutrition-goal";
import { calculateTargets } from "../src/domain/targets";

const NOW = new Date("2026-11-17T10:00:00.000Z");
const health = (patch: Partial<HealthDraft>): HealthProfile =>
  healthFromDraft({ ...draftFromHealth(undefined), ...patch }, undefined, NOW);
const goalFor = (h?: HealthProfile) =>
  buildNutritionGoal(completeProfileAnswers, h, NOW)!;
const general = calculateTargets(completeProfileAnswers, NOW)!;

test("the general calculation is untouched and is carried through as-is", () => {
  const goal = goalFor(undefined);
  assert.deepEqual(goal.generalTarget, general);
  assert.equal(goal.calculationVersion, NUTRITION_GOAL_VERSION);
  assert.equal(goal.calculatedAt, NOW.toISOString());
});

test("a user who reported no conditions keeps exactly the general targets", () => {
  const goal = goalFor(health({ conditions: ["None of the above"] }));
  assert.equal(goal.recommendationStatus, "GENERAL_RECOMMENDATION");
  assert.equal(goal.requiresProfessionalReview, false);
  assert.deepEqual(goal.withheld, []);
  for (const key of ["kcal", "protein", "carbs", "fat", "fiber"] as const) {
    assert.deepEqual(goal.displayedTarget[key], {
      value: general[key],
      source: "APP_ESTIMATE",
    });
  }
});

test("existing users without health data are not treated as having no conditions", () => {
  const goal = goalFor(undefined);
  assert.equal(goal.assessment, "NOT_ASSESSED");
  assert.equal(goal.recommendationStatus, "INSUFFICIENT_INFORMATION");
  // Their current goals are preserved, only labelled as general.
  assert.equal(shownValue(goal, "protein"), general.protein);
  assert.equal(shownValue(goal, "kcal"), general.kcal);
  assert.equal(goal.requiresProfessionalReview, false);
});

test("skipping or declining to disclose is handled like missing information", () => {
  for (const h of [
    health({}),
    health({ conditions: ["Prefer not to disclose"] }),
    health({ conditions: ["None of the above"], professionalGuidance: "Not sure" }),
  ]) {
    const goal = goalFor(h);
    assert.equal(goal.recommendationStatus, "INSUFFICIENT_INFORMATION");
    assert.equal(shownValue(goal, "protein"), general.protein);
  }
});

test("a kidney-related condition withholds protein and carbs without inventing a number", () => {
  const goal = goalFor(health({ conditions: ["Kidney-related condition"] }));
  assert.equal(goal.recommendationStatus, "REVIEW_REQUIRED");
  assert.equal(goal.requiresProfessionalReview, true);
  assert.deepEqual(goal.withheld, ["protein", "carbs"]);
  assert.equal(goal.displayedTarget.protein, null);
  assert.equal(goal.displayedTarget.carbs, null);
  assert.equal(shownValue(goal, "protein"), null);
  // The general value is kept only as a reference.
  assert.equal(goal.generalTarget.protein, general.protein);
  // Unaffected targets still come from the unchanged general calculation.
  assert.equal(shownValue(goal, "kcal"), general.kcal);
  assert.equal(shownValue(goal, "fat"), general.fat);
  assert.ok(goal.notices.includes("kidney"));
});

test("no displayed value is ever anything other than the general estimate or a clinician value", () => {
  const conditions = [
    ["Kidney-related condition"],
    ["Kidney-related condition", "Diabetes (Type 1 / Type 2)"],
    ["Heart-related condition"],
  ] as const;
  for (const list of conditions) {
    const goal = goalFor(health({ conditions: [...list] }));
    for (const key of ["kcal", "protein", "carbs", "fat", "fiber"] as const) {
      const shown = goal.displayedTarget[key];
      if (shown) assert.equal(shown.value, general[key]);
    }
  }
});

test("a clinician-provided protein target is shown as theirs and clearly labelled", () => {
  const goal = goalFor(
    health({ conditions: ["Kidney-related condition"], clinicianProtein: "52" }),
  );
  assert.equal(goal.recommendationStatus, "CLINICIAN_PROVIDED");
  assert.equal(goal.source, "CLINICIAN_PROVIDED");
  assert.deepEqual(goal.displayedTarget.protein, {
    value: 52,
    source: "CLINICIAN_PROVIDED",
  });
  // The app estimate is still available as a reference, unaltered.
  assert.equal(goal.generalTarget.protein, general.protein);
  // Carbs derive from the app's protein figure, so they stay withheld.
  assert.equal(goal.displayedTarget.carbs, null);
  assert.equal(goal.displayedTarget.fat?.source, "APP_ESTIMATE");
});

test("removing kidney from the answers removes the clinician value from the goal", () => {
  const before = health({
    conditions: ["Kidney-related condition"],
    clinicianProtein: "52",
  });
  const after = healthFromDraft(
    { ...draftFromHealth(before), conditions: ["None of the above"] },
    before,
    NOW,
  );
  const goal = goalFor(after);
  assert.equal(goal.recommendationStatus, "GENERAL_RECOMMENDATION");
  assert.equal(shownValue(goal, "protein"), general.protein);
});

test("changing health information changes the recalculated outcome", () => {
  const a = goalFor(health({ conditions: ["None of the above"] }));
  const b = goalFor(health({ conditions: ["Kidney-related condition"] }));
  assert.notEqual(a.recommendationStatus, b.recommendationStatus);
  assert.equal(shownValue(a, "protein"), general.protein);
  assert.equal(shownValue(b, "protein"), null);
});

test("other declared conditions keep the general estimate with an advisory", () => {
  const goal = goalFor(
    health({ conditions: ["Diabetes (Type 1 / Type 2)", "Heart-related condition"] }),
  );
  assert.equal(goal.recommendationStatus, "GENERAL_WITH_ADVISORY");
  assert.equal(goal.requiresProfessionalReview, false);
  assert.equal(shownValue(goal, "protein"), general.protein);
});

test("professional dietary advice adds an advisory even with no conditions", () => {
  const goal = goalFor(
    health({ conditions: ["None of the above"], professionalGuidance: "Yes" }),
  );
  assert.equal(goal.recommendationStatus, "GENERAL_WITH_ADVISORY");
  assert.ok(goal.notices.includes("guidance"));
});

test("a profile too incomplete for a general estimate yields no goal at all", () => {
  assert.equal(buildNutritionGoal({ age: "25–34" }, undefined, NOW), null);
});

test("the context evaluator holds no numbers: it only reports what to withhold", () => {
  const context = evaluateHealthContext(
    health({ conditions: ["Kidney-related condition"] }),
  );
  assert.deepEqual(context.withheld, ["protein", "carbs"]);
  assert.deepEqual(context.clinicianEditable, ["protein"]);
  assert.equal(context.requiresProfessionalReview, true);
  assert.equal(evaluateHealthContext(undefined).assessment, "NOT_ASSESSED");
});
