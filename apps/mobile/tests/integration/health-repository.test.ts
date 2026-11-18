import { strict as assert } from "node:assert";
import { after, test } from "node:test";
import { initializeApp, deleteApp } from "firebase/app";
import {
  connectFirestoreEmulator,
  doc,
  getDoc,
  getFirestore,
  terminate,
} from "firebase/firestore";
import { draftFromHealth, healthFromDraft } from "../../src/domain/health";
import { healthRepository } from "../../src/services/cloud/health-repository";

// Needs the Firestore emulator: npm --prefix functions run test:profiles
const uid = `health-repo-${Date.now()}`;
const names = ["owner", "outsider", "unverified"] as const;
const apps = names.map((name) =>
  initializeApp({ projectId: "demo-nourish" }, `health-${name}`),
);
const clients = apps.map((app, index) => {
  const db = getFirestore(app);
  connectFirestoreEmulator(db, "127.0.0.1", 8080, {
    mockUserToken: {
      sub: index === 1 ? "outsider" : uid,
      email_verified: index !== 2,
    },
  });
  return db;
});
after(async () => {
  await Promise.all(clients.map(terminate));
  await Promise.all(apps.map(deleteApp));
});

const health = (conditions: string[], clinician = "") =>
  healthFromDraft({
    ...draftFromHealth(undefined),
    conditions: conditions as never,
    clinicianProtein: clinician,
  }, undefined);

test("the owner can back up, read, update and delete health information", { timeout: 20000 }, async () => {
  const owner = healthRepository(clients[0], uid);
  assert.equal(await owner.get(), null);
  const first = health(["Kidney-related condition"], "52");
  await owner.save(first);
  const saved = await owner.get();
  assert.equal(saved?.revision, 1);
  assert.deepEqual(saved?.health, first);
  await owner.save(health(["None of the above"]));
  const second = await owner.get();
  assert.equal(second?.revision, 2);
  assert.equal(second?.generation, saved?.generation);
  await owner.remove();
  assert.equal(await owner.get(), null);
});

test("another account and an unverified owner cannot read or write it", { timeout: 20000 }, async () => {
  await healthRepository(clients[0], uid).save(health(["Heart-related condition"]));
  await assert.rejects(healthRepository(clients[1], uid).get());
  await assert.rejects(healthRepository(clients[2], uid).get());
  await assert.rejects(healthRepository(clients[2], uid).save(health([])));
  await assert.rejects(getDoc(doc(clients[1], "mobileHealthProfiles", uid)));
  await healthRepository(clients[0], uid).remove();
});
