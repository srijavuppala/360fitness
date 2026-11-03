import { strict as assert } from "node:assert";
import { test } from "node:test";
import { completeProfileAnswers, initialState, sampleMeals } from "../src/domain/fixtures";
import { parseSavedState, recordMeal } from "../src/domain/meals";
import {
  changeAnswer,
  normalizeCheckInTime,
  formatCheckInTime,
  ProfileAnswers,
  profileSteps,
  saveProfile,
  stepErrors,
  toggleSelection,
  validateAnswerShape,
  validateProfileDraft,
  migrateProfileAnswers,
  migrateSavedProfile,
} from "../src/domain/profile";

const complete: ProfileAnswers = { ...completeProfileAnswers };

test("legacy saved meals load without requiring a new profile", () => {
  const old = recordMeal(
    { ...initialState(), onboarding: "complete" },
    sampleMeals[0],
    "2026-10-07",
    "confirmed",
  );
  assert.deepEqual(parseSavedState(JSON.stringify(old)), old);
});
test("profile completion preserves meals, synchronizes goal and clears draft", () => {
  const old = recordMeal(
    initialState(),
    sampleMeals[0],
    "2026-10-07",
    "confirmed",
  );
  const saved = saveProfile(
    { ...old, profileDraft: { version: 1, answers: complete, step: 4 } },
    complete,
  );
  assert.deepEqual(saved.entries, old.entries);
  assert.deepEqual(saved.templates, old.templates);
  assert.equal(saved.goal, "fitness");
  assert.equal(saved.onboarding, "routine");
  assert.equal(saved.profileDraft, undefined);
  assert.deepEqual(parseSavedState(JSON.stringify(saved)), saved);
  assert.equal(
    saveProfile({ ...saved, onboarding: "complete" }, complete).onboarding,
    "complete",
  );
});
test("all required questions are enforced and optional questions can be skipped", () => {
  for (let index = 0; index < profileSteps.length; index++) {
    assert.deepEqual(stepErrors(complete, index), {});
    for (const question of profileSteps[index].questions.filter(
      (q) => q.required && !q.when,
    )) {
      const incomplete = { ...complete };
      delete incomplete[question.key];
      assert.throws(
        () => saveProfile(initialState(), incomplete),
        question.key,
      );
    }
  }
});
test("drafts resume incomplete input without replacing a completed profile", () => {
  const saved = saveProfile(initialState(), complete);
  const state = {
    ...saved,
    profileDraft: {
      version: 1 as const,
      step: 0,
      answers: { ...complete, heightCm: "16" },
    },
  };
  const loaded = parseSavedState(JSON.stringify(state));
  assert.equal(loaded.profileDraft?.step, 0);
  assert.equal(loaded.profileDraft?.answers.heightCm, "16");
  assert.equal(loaded.profile?.answers.heightCm, "165");
  assert.throws(() => saveProfile(loaded, loaded.profileDraft!.answers));
});
test("exclusive allergy selections cannot coexist", () => {
  assert.deepEqual(toggleSelection(["None known"], "Peanuts"), ["Peanuts"]);
  assert.deepEqual(toggleSelection(["Peanuts", "Milk"], "Not sure"), [
    "Not sure",
  ]);
  assert.deepEqual(toggleSelection(["Milk"], "Milk"), []);
  assert.throws(() =>
    validateAnswerShape({ allergies: ["None known", "Peanuts"] }),
  );
});
test("weekly pace is hidden when the goal is to maintain weight", () => {
  const maintaining = changeAnswer(complete, "targetWeightKg", "72.5");
  assert.equal(maintaining.weeklyPace, undefined);
  assert.doesNotThrow(() => saveProfile(initialState(), maintaining));
  assert.equal(
    changeAnswer(
      { ...complete, diet: "Other", dietOther: "Example" },
      "diet",
      "Vegan",
    ).dietOther,
    undefined,
  );
  assert.equal(
    changeAnswer(
      { ...complete, allergies: ["Other"], allergyOther: "Example" },
      "allergies",
      ["None known"],
    ).allergyOther,
    undefined,
  );
  assert.throws(() =>
    saveProfile(initialState(), { ...complete, allergies: ["Other"] }),
  );
  assert.throws(() =>
    saveProfile(initialState(), { ...complete, diet: "Other" }),
  );
});
test("height and weight reject invalid numbers", () => {
  for (const value of [
    "0",
    "-1",
    "NaN",
    "Infinity",
    "1e2",
    "7,2",
    "72kg",
    "99",
    "1.234",
  ]) {
    assert.ok(
      stepErrors({ ...complete, heightCm: value }, 0).heightCm,
      value,
    );
  }
  for (const value of ["0", "24", "351", "abc"])
    assert.ok(
      stepErrors({ ...complete, currentWeightKg: value }, 0).currentWeightKg,
      value,
    );
  assert.deepEqual(stepErrors({ ...complete, heightCm: "165" }, 0), {});
});
test("corrupted profile data is rejected instead of silently replacing data", () => {
  for (const answers of [
    null,
    [],
    { diet: 123 },
    { diet: "unknown" },
    { allergies: "Milk" },
    { allergies: ["Milk", "Milk"] },
    { outcome: "a".repeat(301) },
  ])
    assert.throws(() => validateAnswerShape(answers));
  for (const step of [-1, 8, 0.5])
    assert.throws(() =>
      validateProfileDraft({ version: 1, step, answers: {} }),
    );
  assert.throws(() =>
    parseSavedState(
      JSON.stringify({
        ...initialState(),
        profile: { version: 1, answers: complete, updatedAt: "no" },
      }),
    ),
  );
});
test("finishing copies answers and trims text, without inventing optional answers", () => {
  const input = { ...complete, outcome: "  A steady routine  " };
  const saved = saveProfile(initialState(), input);
  assert.equal(saved.profile?.answers.outcome, "A steady routine");
  assert.equal(saved.profile?.answers.weeklyPace, complete.weeklyPace);
  assert.notEqual(saved.profile?.answers.allergies, input.allergies);
});
test("v1 weight carries over; waist and retired keys are dropped", () => {
  assert.deepEqual(migrateProfileAnswers({
    metric: "Weight (kg)",
    metricValue: "72.5",
    age: "25–34",
    checkInTime: "19:30",
    groceryBudget: "50",
  }), {
    currentWeightKg: "72.5",
    age: "25–34",
  });
  assert.deepEqual(migrateProfileAnswers({
    metric: "Waist (cm)",
    metricValue: "80",
    age: "25–34",
  }), { age: "25–34" });
  const pounds = migrateProfileAnswers({
    metric: "Weight (lb)",
    metricValue: "160",
  }) as ProfileAnswers;
  assert.equal(pounds.currentWeightKg, "72.6");
});
test("incomplete v1 profiles reopen as a draft instead of failing to load", () => {
  const migrated = migrateSavedProfile(
    {
      version: 1,
      answers: { metric: "Weight (kg)", metricValue: "72.5", age: "25–34" },
      updatedAt: "2026-10-01T00:00:00.000Z",
    },
    undefined,
  );
  assert.equal(migrated.profile, undefined);
  assert.equal(migrated.profileDraft?.answers.currentWeightKg, "72.5");
  assert.equal(migrated.profileDraft?.question, "sex");
});
test("12-hour times still convert noon and midnight", () => {
  for (const [input, stored, display] of [
    ["7:30 PM", "19:30", "7:30 PM"],
    ["07:30 am", "07:30", "7:30 AM"],
    ["12:00 AM", "00:00", "12:00 AM"],
    ["12:00 PM", "12:00", "12:00 PM"],
    ["11:59pm", "23:59", "11:59 PM"],
  ]) {
    assert.equal(normalizeCheckInTime(input), stored);
    assert.equal(formatCheckInTime(stored), display);
  }
});
test("retired drafts on removed questions resume at a live question", () => {
  const loaded = parseSavedState(
    JSON.stringify({
      ...initialState(),
      profileDraft: {
        version: 1,
        step: 5,
        question: "checkInTime",
        answers: { ...complete, checkInTime: "2:" },
      },
    }),
  );
  assert.equal(
    Object.prototype.hasOwnProperty.call(
      loaded.profileDraft?.answers ?? {},
      "checkInTime",
    ),
    false,
  );
  assert.equal(loaded.profileDraft?.question, "review");
});
