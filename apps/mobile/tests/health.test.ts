import { strict as assert } from "node:assert";
import { test } from "node:test";
import { completeProfileAnswers, initialState } from "../src/domain/fixtures";
import {
  conditionOptions,
  draftFromHealth,
  HealthDraft,
  healthFromDraft,
  parseClinicianProtein,
  toggleCondition,
  validateHealthProfile,
} from "../src/domain/health";
import { parseSavedState } from "../src/domain/meals";
import { saveProfile } from "../src/domain/profile";

const NOW = new Date("2026-11-17T10:00:00.000Z");
const empty = (): HealthDraft => draftFromHealth(undefined);

test("selecting no conditions or skipping leaves nothing to store", () => {
  // Skipping never writes health data: the state simply has no `health`.
  const state = saveProfile(initialState(), completeProfileAnswers);
  assert.equal(state.health, undefined);
  // An empty form stores consent only, with no answers.
  const health = healthFromDraft(empty(), undefined, NOW);
  assert.equal(health.conditions, undefined);
  assert.equal(health.consentGivenAt, NOW.toISOString());
});

test("one and several conditions can be selected and deselected", () => {
  let selected = toggleCondition([], "Kidney-related condition");
  assert.deepEqual(selected, ["Kidney-related condition"]);
  selected = toggleCondition(selected, "Thyroid-related condition");
  assert.deepEqual(selected, [
    "Kidney-related condition",
    "Thyroid-related condition",
  ]);
  selected = toggleCondition(selected, "Kidney-related condition");
  assert.deepEqual(selected, ["Thyroid-related condition"]);
});

test("None of the above and Prefer not to disclose are mutually exclusive", () => {
  const some = toggleCondition([], "Diabetes (Type 1 / Type 2)");
  assert.deepEqual(toggleCondition(some, "None of the above"), [
    "None of the above",
  ]);
  assert.deepEqual(toggleCondition(some, "Prefer not to disclose"), [
    "Prefer not to disclose",
  ]);
  assert.deepEqual(
    toggleCondition(["Prefer not to disclose"], "None of the above"),
    ["None of the above"],
  );
  // Picking a real condition clears an exclusive choice.
  assert.deepEqual(
    toggleCondition(["None of the above"], "Heart-related condition"),
    ["Heart-related condition"],
  );
  assert.equal(conditionOptions.length, 9);
});

test("Other keeps an optional short note only while Other is selected", () => {
  const draft: HealthDraft = {
    ...empty(),
    conditions: ["Other health condition"],
    conditionOther: "  Gout  ",
  };
  assert.equal(healthFromDraft(draft, undefined, NOW).conditionOther, "Gout");
  const noNote = healthFromDraft({ ...draft, conditionOther: "" }, undefined, NOW);
  assert.equal(noNote.conditionOther, undefined);
  const dropped = healthFromDraft(
    { ...draft, conditions: ["Heart-related condition"] },
    undefined,
    NOW,
  );
  assert.equal(dropped.conditionOther, undefined);
});

test("restriction notes are kept only when the answer is Yes", () => {
  const base: HealthDraft = {
    ...empty(),
    dietaryRestrictions: "Yes",
    dietaryRestrictionsNote: "Low salt",
    professionalGuidance: "No",
    professionalGuidanceNote: "stale",
  };
  const health = healthFromDraft(base, undefined, NOW);
  assert.equal(health.dietaryRestrictionsNote, "Low salt");
  assert.equal(health.professionalGuidance, "No");
  assert.equal(health.professionalGuidanceNote, undefined);
});

test("editing keeps the original consent time and updates the rest", () => {
  const first = healthFromDraft(
    { ...empty(), conditions: ["Prefer not to disclose"] },
    undefined,
    NOW,
  );
  const later = new Date("2026-12-01T10:00:00.000Z");
  const edited = healthFromDraft(
    { ...draftFromHealth(first), conditions: ["None of the above"] },
    first,
    later,
  );
  assert.equal(edited.consentGivenAt, first.consentGivenAt);
  assert.equal(edited.updatedAt, later.toISOString());
  assert.deepEqual(edited.conditions, ["None of the above"]);
});

test("a clinician protein value is whole grams and only kept for kidney", () => {
  assert.equal(parseClinicianProtein("55"), 55);
  for (const bad of ["", "0", "-5", "5.5", "abc", "501", "1e2"])
    assert.equal(parseClinicianProtein(bad), null, bad);
  const draft: HealthDraft = {
    ...empty(),
    conditions: ["Kidney-related condition"],
    clinicianProtein: "55",
  };
  const kept = healthFromDraft(draft, undefined, NOW);
  assert.deepEqual(kept.clinicianProtein, {
    grams: 55,
    enteredAt: NOW.toISOString(),
  });
  // Same value on re-save keeps the original entry time.
  const again = healthFromDraft(draft, kept, new Date("2027-01-01"));
  assert.equal(again.clinicianProtein?.enteredAt, NOW.toISOString());
  // Deselecting kidney drops it.
  const dropped = healthFromDraft(
    { ...draft, conditions: ["Heart-related condition"] },
    kept,
    NOW,
  );
  assert.equal(dropped.clinicianProtein, undefined);
  assert.throws(() =>
    healthFromDraft({ ...draft, clinicianProtein: "5.5" }, undefined, NOW),
  );
});

test("invalid health data is rejected without echoing what was entered", () => {
  const valid = healthFromDraft(
    { ...empty(), conditions: ["Kidney-related condition"] },
    undefined,
    NOW,
  );
  const bad: unknown[] = [
    { ...valid, extra: "SECRET-DIAGNOSIS" },
    { ...valid, conditions: ["SECRET-DIAGNOSIS"] },
    { ...valid, conditions: ["None of the above", "Heart-related condition"] },
    { ...valid, conditionOther: "SECRET-DIAGNOSIS" },
    { ...valid, dietaryRestrictionsNote: "SECRET-DIAGNOSIS" },
    { ...valid, clinicianProtein: { grams: 9999, enteredAt: valid.updatedAt } },
    { ...valid, version: 2 },
    null,
  ];
  for (const value of bad)
    assert.throws(
      () => validateHealthProfile(value),
      (error: Error) => {
        assert.doesNotMatch(error.message, /SECRET/);
        return true;
      },
    );
});

test("existing saved state without health still opens unchanged", () => {
  const old = saveProfile(
    { ...initialState(), onboarding: "complete" },
    completeProfileAnswers,
  );
  const parsed = parseSavedState(JSON.stringify(old));
  assert.equal(parsed.health, undefined);
  assert.deepEqual(parsed, old);
});

test("saved health round-trips, and an unreadable copy is dropped, not fatal", () => {
  const health = healthFromDraft(
    { ...empty(), conditions: ["Liver-related condition"] },
    undefined,
    NOW,
  );
  const state = { ...initialState(), health };
  assert.deepEqual(parseSavedState(JSON.stringify(state)).health, health);
  const corrupt = { ...state, health: { ...health, conditions: ["nope"] } };
  const parsed = parseSavedState(JSON.stringify(corrupt));
  assert.equal(parsed.health, undefined);
  assert.equal(parsed.onboarding, "welcome");
});

test("saving the profile keeps existing health information", () => {
  const health = healthFromDraft(empty(), undefined, NOW);
  const next = saveProfile({ ...initialState(), health }, completeProfileAnswers);
  assert.deepEqual(next.health, health);
});
