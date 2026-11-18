import { strict as assert } from "node:assert";
import { readdirSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { parseCloudHealth } from "../src/domain/cloud-health";
import {
  answerOptions,
  conditionOptions,
  draftFromHealth,
  healthFromDraft,
  NOTE_MAX_LENGTH,
  OTHER_MAX_LENGTH,
  CLINICIAN_PROTEIN_MAX_G,
} from "../src/domain/health";

const root = new URL("../", import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), "utf8");
const rules = readFileSync(
  new URL("../../firestore.rules", root),
  "utf8",
);

test("the Firestore rules use the same option lists and limits as the app", () => {
  const block = rules.slice(rules.indexOf("validHealthText"));
  assert.ok(block.includes(JSON.stringify(conditionOptions)));
  assert.ok(block.includes(JSON.stringify(answerOptions)));
  assert.ok(block.includes(`'conditionOther', ${OTHER_MAX_LENGTH}`));
  assert.ok(block.includes(`, 'dietaryRestrictionsNote'`));
  assert.ok(block.includes(`validHealthText(h, noteField, ${NOTE_MAX_LENGTH})`));
  assert.ok(block.includes(`grams <= ${CLINICIAN_PROTEIN_MAX_G}`));
});

test("health backups are owner-only, not under the unvalidated users wildcard", () => {
  const match = rules.slice(rules.indexOf("match /mobileHealthProfiles/{uid}"));
  assert.match(match, /isOwner\(uid\) && request\.auth\.token\.email_verified == true/);
  assert.doesNotMatch(match.split("// Anything not matched")[0], /allow [a-z, ]+: if true/);
  assert.ok(!rules.includes("users/{uid}/healthProfile"));
});

test("health code never logs, and the app has no analytics that could receive it", () => {
  const files = [
    "src/domain/health.ts",
    "src/domain/health-context.ts",
    "src/domain/health-copy.ts",
    "src/domain/nutrition-goal.ts",
    "src/domain/cloud-health.ts",
    "src/services/cloud/health-repository.ts",
    "src/app/health.tsx",
    "src/components/HealthGoalCard.tsx",
  ];
  for (const file of files)
    assert.doesNotMatch(
      read(file),
      /console\.|logEvent|logger\.|analytics\(|Analytics/,
      file,
    );
  const everything = (readdirSync(new URL("src/", root), {
    recursive: true,
  }) as string[]).filter((file) => /\.tsx?$/.test(file));
  for (const file of everything)
    assert.doesNotMatch(read(`src/${file}`), /logEvent|firebase\/analytics/, file);
});

test("a cloud health copy needs consent, a valid revision and generation, and a valid body", () => {
  const health = healthFromDraft(
    { ...draftFromHealth(undefined), conditions: ["Heart-related condition"] },
    undefined,
    new Date("2026-11-17T10:00:00Z"),
  );
  const good = {
    schemaVersion: 1,
    revision: 1,
    generation: "a".repeat(20),
    backupConsent: true,
    health,
  };
  assert.deepEqual(parseCloudHealth(good).health, health);
  for (const bad of [
    { ...good, backupConsent: false },
    { ...good, revision: 0 },
    { ...good, generation: "short" },
    { ...good, schemaVersion: 2 },
    { ...good, health: { ...health, conditions: ["SECRET-DIAGNOSIS"] } },
    null,
  ])
    assert.throws(
      () => parseCloudHealth(bad),
      (error: Error) => {
        assert.doesNotMatch(error.message, /SECRET/);
        return true;
      },
    );
});
