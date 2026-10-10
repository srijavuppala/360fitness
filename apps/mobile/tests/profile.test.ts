import { strict as assert } from "node:assert";
import { test } from "node:test";
import { initialState, sampleMeals } from "../src/domain/fixtures";
import { parseSavedState, recordMeal } from "../src/domain/meals";
import {
  changeAnswer,
  normalizeCheckInTime,
  formatCheckInTime,
  answerLabel,
  ProfileAnswers,
  profileSteps,
  saveProfile,
  stepErrors,
  toggleSelection,
  validateAnswerShape,
  validateProfileDraft,
} from "../src/domain/profile";

const complete: ProfileAnswers = {
  age: "25–34",
  metric: "Weight (kg)",
  metricValue: "72.5",
  primaryGoal: "Support my fitness",
  outcome: "Train three days each week",
  activity: "Moderately active",
  diet: "No specific diet",
  allergies: ["None known"],
  workouts: ["Walking", "Strength training"],
  workoutFrequency: "3–4 days a week",
  tracking: "Quick meal check-ins",
  notifications: "Off",
  voice: "Text only",
  checkInTime: "19:30",
};

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
    { ...old, profileDraft: { version: 1, answers: complete, step: 7 } },
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
      step: 5,
      answers: { ...complete, checkInTime: "2:" },
    },
  };
  const loaded = parseSavedState(JSON.stringify(state));
  assert.equal(loaded.profileDraft?.step, 5);
  assert.equal(loaded.profileDraft?.answers.checkInTime, "2:");
  assert.equal(loaded.profile?.answers.checkInTime, "19:30");
  assert.throws(() => saveProfile(loaded, loaded.profileDraft!.answers));
});
test("exclusive selections cannot coexist with actual allergies or workouts", () => {
  assert.deepEqual(toggleSelection(["None known"], "Peanuts"), ["Peanuts"]);
  assert.deepEqual(toggleSelection(["Peanuts", "Milk"], "Not sure"), [
    "Not sure",
  ]);
  assert.deepEqual(toggleSelection(["Walking"], "No preference yet"), [
    "No preference yet",
  ]);
  assert.deepEqual(toggleSelection(["None"], "Apple Watch"), ["Apple Watch"]);
  assert.deepEqual(toggleSelection(["Milk"], "Milk"), []);
  assert.throws(() =>
    validateAnswerShape({ allergies: ["None known", "Peanuts"] }),
  );
});
test("hidden measurements and conditional details are removed", () => {
  const privateAnswers = changeAnswer(
    complete,
    "metric",
    "Prefer not to share",
  );
  assert.equal(privateAnswers.metricValue, undefined);
  assert.doesNotThrow(() => saveProfile(initialState(), privateAnswers));
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
test("measurement and budget reject invalid numbers; budget zero is valid", () => {
  for (const value of [
    "0",
    "-1",
    "NaN",
    "Infinity",
    "1e2",
    "7,2",
    "72kg",
    "100001",
    "1.234",
  ]) {
    assert.ok(
      stepErrors({ ...complete, metricValue: value }, 0).metricValue,
      value,
    );
  }
  for (const value of ["-1", "abc", "Infinity", "100001"])
    assert.ok(
      stepErrors({ ...complete, groceryBudget: value }, 6).groceryBudget,
    );
  assert.deepEqual(stepErrors({ ...complete, groceryBudget: "0" }, 6), {});
});
test("existing HH:mm check-in times remain compatible", () => {
  for (const value of ["24:00", "12:60", "9:00", "8pm", ""])
    assert.ok(stepErrors({ ...complete, checkInTime: value }, 5).checkInTime);
  for (const value of ["00:00", "23:59", "09:00"])
    assert.deepEqual(stepErrors({ ...complete, checkInTime: value }, 5), {});
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
  const input = { ...complete, outcome: "  A steady routine  ", wearables: [] };
  const saved = saveProfile(initialState(), input);
  assert.equal(saved.profile?.answers.outcome, "A steady routine");
  assert.equal(saved.profile?.answers.wearables, undefined);
  assert.equal(saved.profile?.answers.groceryBudget, undefined);
  assert.notEqual(saved.profile?.answers.workouts, input.workouts);
});

test("12-hour check-in times convert noon and midnight without changing the day", () => {
  for (const [input, stored, display] of [
    ["7:30 PM", "19:30", "7:30 PM"],
    ["07:30 am", "07:30", "7:30 AM"],
    ["12:00 AM", "00:00", "12:00 AM"],
    ["12:00 PM", "12:00", "12:00 PM"],
    ["11:59pm", "23:59", "11:59 PM"],
  ]) {
    assert.equal(normalizeCheckInTime(input), stored);
    assert.equal(formatCheckInTime(stored), display);
    const saved = saveProfile(initialState(), {
      ...complete,
      checkInTime: input,
    });
    assert.equal(saved.profile?.answers.checkInTime, stored);
    assert.equal(answerLabel(saved.profile!.answers, "checkInTime"), display);
    assert.deepEqual(parseSavedState(JSON.stringify(saved)), saved);
  }
});

test("incomplete and invalid 12-hour times remain editable and cannot be submitted", () => {
  for (const input of [
    "7:30",
    "0:30 AM",
    "13:30 PM",
    "7:60 AM",
    "7:30 P",
    "12:00 XM",
  ]) {
    assert.equal(normalizeCheckInTime(input), null);
    assert.equal(formatCheckInTime(input), input);
    assert.match(
      stepErrors({ ...complete, checkInTime: input }, 5).checkInTime!,
      /AM or PM/,
    );
  }
});

test("diet explanation is optional, bounded and included in saved profile", () => {
  const saved = saveProfile(initialState(), {
    ...complete,
    dietPlan: "a".repeat(1000),
  });
  assert.equal(saved.profile?.answers.dietPlan?.length, 1000);
  assert.throws(() =>
    saveProfile(initialState(), { ...complete, dietPlan: "a".repeat(1001) }),
  );
  assert.throws(() =>
    saveProfile(initialState(), { ...complete, outcome: "a".repeat(301) }),
  );
  assert.deepEqual(parseSavedState(JSON.stringify(saved)), saved);
});
