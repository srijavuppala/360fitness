import { strict as assert } from "node:assert";
import { test } from "node:test";
import { changeAnswer, validateProfileDraft } from "../src/domain/profile";
import {
  draftAt,
  firstProfileIssue,
  profilePages,
  resumeProfile,
} from "../src/domain/profile-flow";

test("legacy group drafts resume at their group, not a reinterpreted question number", () => {
  assert.equal(
    resumeProfile({ version: 1, step: 3, answers: {} }, false),
    "diet",
  );
  assert.equal(
    resumeProfile({ version: 1, step: 4, answers: {} }, false),
    "review",
  );
  assert.equal(resumeProfile(undefined, true), "review");
  assert.equal(resumeProfile(undefined, false), "age");
});
test("new drafts round-trip the exact question and reject a mismatched group", () => {
  const draft = draftAt({ diet: "Vegan" }, "diet");
  validateProfileDraft(draft);
  assert.equal(resumeProfile(JSON.parse(JSON.stringify(draft)), false), "diet");
  assert.equal(draft.step, 3);
  assert.throws(() => validateProfileDraft({ ...draft, question: "age" }));
  assert.throws(() => validateProfileDraft({ ...draft, question: "review" }));
  assert.doesNotThrow(() => validateProfileDraft(draftAt({}, "review")));
});
test("conditional pages appear and disappear with the parent answer", () => {
  const vegan = { diet: "Vegan" };
  assert.ok(!profilePages(vegan).some((p) => p.question.key === "dietOther"));
  const otherDiet = changeAnswer(vegan, "diet", "Other");
  assert.ok(
    profilePages(otherDiet).some((p) => p.question.key === "dietOther"),
  );
  assert.equal(firstProfileIssue(otherDiet, 3)?.cursor, "dietOther");
  const restored = changeAnswer(
    { ...otherDiet, dietOther: "Example" },
    "diet",
    "Vegan",
  );
  assert.equal(restored.dietOther, undefined);
  assert.ok(
    !profilePages(restored).some((p) => p.question.key === "dietOther"),
  );
  assert.equal(
    resumeProfile(
      { version: 1, step: 3, question: "dietOther", answers: restored },
      false,
    ),
    "diet",
  );
});
test("review finds the first visible missing answer", () => {
  assert.equal(
    firstProfileIssue({ age: "25–34" }, 0)?.cursor,
    "sex",
  );
  assert.equal(
    firstProfileIssue(
      {
        age: "25–34",
        sex: "Female",
        heightCm: "165",
        currentWeightKg: "72.5",
      },
      0,
    ),
    null,
  );
  assert.equal(
    firstProfileIssue({ diet: "Vegan", allergies: ["Other"] }, 3)?.cursor,
    "allergyOther",
  );
});
