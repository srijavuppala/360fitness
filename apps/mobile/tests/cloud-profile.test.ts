import { strict as assert } from "node:assert";
import { test } from "node:test";
import { assertRevision, parseCloudProfile } from "../src/domain/cloud-profile";
import { saveProfile } from "../src/domain/profile";
import { completeProfileAnswers, initialState } from "../src/domain/fixtures";
import { accountError } from "../src/services/cloud/errors";

export const validProfile = () =>
  saveProfile(initialState(), {
    ...completeProfileAnswers,
    primaryGoal: "Build consistent habits",
    outcome: "Cook at home",
  }).profile!;

test("cloud restore rejects unknown schema, invalid revision and incomplete onboarding", () => {
  const valid = {
    schemaVersion: 1,
    revision: 2,
    generation: "abcdefghijklmnopqrst",
    profile: validProfile(),
  };
  assert.deepEqual(parseCloudProfile(valid), valid);
  for (const bad of [
    null,
    {},
    { ...valid, schemaVersion: 2 },
    { ...valid, revision: 0 },
    { ...valid, revision: 1.5 },
    { ...valid, profile: { ...valid.profile, answers: {} } },
  ])
    assert.throws(() => parseCloudProfile(bad));
});
test("stale cloud saves cannot overwrite a newer revision", () => {
  assert.doesNotThrow(() => assertRevision(0, 0));
  assert.doesNotThrow(() => assertRevision(5, 5));
  assert.throws(() => assertRevision(6, 5), /another device/);
});
test("account failures do not expose raw provider details", () => {
  assert.match(accountError({ code: "unavailable" }), /local profile is safe/);
  assert.doesNotMatch(
    accountError(new Error("secret provider response")),
    /secret/,
  );
});
