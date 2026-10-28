import { strict as assert } from "node:assert";
import { after, test } from "node:test";
import { initializeApp, deleteApp } from "firebase/app";
import {
  connectFirestoreEmulator,
  getDoc,
  doc,
  getFirestore,
  terminate,
} from "firebase/firestore";
import { profileRepository } from "../../src/services/cloud/profile-repository";
import { saveProfile } from "../../src/domain/profile";
import { completeProfileAnswers, initialState } from "../../src/domain/fixtures";

const profile = saveProfile(initialState(), {
  ...completeProfileAnswers,
  primaryGoal: "Build consistent habits",
  outcome: "Cook at home",
}).profile!;
const uid = `repository-${Date.now()}`;
const apps = [1, 2, 3, 4].map((number) =>
  initializeApp({ projectId: "demo-nourish" }, `test-device-${number}`),
);
const clients = apps.map((app, index) => {
  const db = getFirestore(app);
  connectFirestoreEmulator(db, "127.0.0.1", index === 3 ? 65530 : 8080, {
    mockUserToken: {
      sub: index === 2 ? "other-person" : uid,
      email_verified: true,
    },
  });
  return db;
});
after(async () => {
  await Promise.all(clients.map(terminate));
  await Promise.all(apps.map(deleteApp));
});

test(
  "two devices observe profile saves, reject stale overwrites, restore and delete",
  { timeout: 20000 },
  async () => {
    const writer = profileRepository(clients[0], uid);
    const reader = profileRepository(clients[1], uid);
    await writer.save(profile, 0);
    const generation = (
      await getDoc(doc(clients[0], "mobileProfiles", uid))
    ).data()!.generation;
    const received = new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        stop();
        reject(new Error("No live update received"));
      }, 10000);
      const stop = reader.watch((value, cached) => {
        if (!cached && value?.revision === 2) {
          try {
            assert.equal(value.profile.answers.outcome, "Walk daily");
            clearTimeout(timer);
            stop();
            resolve();
          } catch (error) {
            reject(error);
          }
        }
      }, reject);
    });
    await writer.save(
      { ...profile, answers: { ...profile.answers, outcome: "Walk daily" } },
      1,
      generation,
    );
    await received;
    await assert.rejects(
      reader.save(profile, 1, generation),
      /changed on another device/,
    );
    await assert.rejects(
      profileRepository(clients[2], uid).save(profile, 2, generation),
    );
    await reader.remove(2, generation);
    const absent = new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        stop();
        reject(new Error("Deletion not observed"));
      }, 5000);
      const stop = writer.watch((value, cached) => {
        if (!cached && value === null) {
          clearTimeout(timer);
          stop();
          resolve();
        }
      }, reject);
    });
    await absent;
    await writer.save(profile, 0);
    await assert.rejects(
      reader.save(profile, 1, generation),
      /changed on another device/,
    );
    await assert.rejects(
      reader.remove(1, generation),
      /changed on another device/,
    );
  },
);
test(
  "offline save reports failure instead of claiming cloud persistence",
  { timeout: 30000 },
  async () => {
    // An unreachable local endpoint models network failure without touching the live database.
    await assert.rejects(profileRepository(clients[3], uid).save(profile, 0));
  },
);
