// Exercises firestore.rules against the Firestore emulator.
//
// Every document a user owns lives under users/{uid}, so the whole security
// model is one ownership check. These tests prove it holds for each path the
// app actually writes, and that nothing leaks between accounts.
//
// Run with:  npm run test:rules

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, beforeEach, describe, it } from 'node:test';

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore';

let testEnv;
let alice;
let bob;
let anonymous;

const ALICE = 'alice-uid';
const BOB = 'bob-uid';

/** Every path the app writes, from lib/core/constants.dart. */
const ownedPaths = [
  ['a website record', (uid) => `users/${uid}/webRecords/profile`],
  ['the user document', (uid) => `users/${uid}`],
  ['the quiz profile', (uid) => `users/${uid}/profile/main`],
  ['calorie and macro targets', (uid) => `users/${uid}/targets/current`],
  ['a plan meal', (uid) => `users/${uid}/planMeals/breakfast-1`],
  ['an onboarding chat message', (uid) => `users/${uid}/chatLog/msg-1`],
  ['a daily check-in', (uid) => `users/${uid}/days/2026-09-21`],
  ['notification settings', (uid) => `users/${uid}/settings/notifications`],
];

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-nourish',
    firestore: {
      rules: readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  });

  alice = testEnv.authenticatedContext(ALICE).firestore();
  bob = testEnv.authenticatedContext(BOB).firestore();
  anonymous = testEnv.unauthenticatedContext().firestore();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

after(async () => {
  await testEnv.cleanup();
});

describe('a signed-in user and their own data', () => {
  for (const [label, path] of ownedPaths) {
    it(`can write and read back ${label}`, async () => {
      await assertSucceeds(setDoc(doc(alice, path(ALICE)), { value: 1 }));
      await assertSucceeds(getDoc(doc(alice, path(ALICE))));
    });

    it(`can delete ${label}`, async () => {
      await testEnv.withSecurityRulesDisabled(async (admin) => {
        await setDoc(doc(admin.firestore(), path(ALICE)), { value: 1 });
      });
      await assertSucceeds(deleteDoc(doc(alice, path(ALICE))));
    });
  }

  it('can list their own plan meals', async () => {
    await assertSucceeds(getDocs(collection(alice, `users/${ALICE}/planMeals`)));
  });

  it('can list their own check-in history', async () => {
    await assertSucceeds(getDocs(collection(alice, `users/${ALICE}/days`)));
  });
});

describe('another signed-in user', () => {
  for (const [label, path] of ownedPaths) {
    it(`cannot read ${label}`, async () => {
      await testEnv.withSecurityRulesDisabled(async (admin) => {
        await setDoc(doc(admin.firestore(), path(ALICE)), { value: 1 });
      });
      await assertFails(getDoc(doc(bob, path(ALICE))));
    });

    it(`cannot write ${label}`, async () => {
      await assertFails(setDoc(doc(bob, path(ALICE)), { value: 666 }));
    });

    it(`cannot delete ${label}`, async () => {
      await testEnv.withSecurityRulesDisabled(async (admin) => {
        await setDoc(doc(admin.firestore(), path(ALICE)), { value: 1 });
      });
      await assertFails(deleteDoc(doc(bob, path(ALICE))));
    });
  }

  it("cannot list another user's plan meals", async () => {
    await assertFails(getDocs(collection(bob, `users/${ALICE}/planMeals`)));
  });

  it("cannot list another user's check-in history", async () => {
    await assertFails(getDocs(collection(bob, `users/${ALICE}/days`)));
  });

  it('cannot list the users collection to discover accounts', async () => {
    await assertFails(getDocs(collection(bob, 'users')));
  });
});

describe('a signed-out visitor', () => {
  for (const [label, path] of ownedPaths) {
    it(`cannot read ${label}`, async () => {
      await testEnv.withSecurityRulesDisabled(async (admin) => {
        await setDoc(doc(admin.firestore(), path(ALICE)), { value: 1 });
      });
      await assertFails(getDoc(doc(anonymous, path(ALICE))));
    });

    it(`cannot write ${label}`, async () => {
      await assertFails(setDoc(doc(anonymous, path(ALICE)), { value: 1 }));
    });
  }
});

describe('anything outside a user document', () => {
  const strayPaths = [
    'config/global',
    'analysisUsage/alice-uid',
    'experts/some-expert',
    'bookings/some-booking',
    'users',
  ];

  for (const path of strayPaths) {
    // `users` is a collection, not a document, so only test document paths.
    if (path === 'users') continue;

    it(`is closed to a signed-in user: ${path}`, async () => {
      await assertFails(setDoc(doc(alice, path), { value: 1 }));
      await assertFails(getDoc(doc(alice, path)));
    });

    it(`is closed to a signed-out visitor: ${path}`, async () => {
      await assertFails(setDoc(doc(anonymous, path), { value: 1 }));
      await assertFails(getDoc(doc(anonymous, path)));
    });
  }
});

describe('the ownership check itself', () => {
  it('matches on the uid in the path, not merely on being signed in', async () => {
    // Bob is authenticated; that must not be enough.
    await assertFails(setDoc(doc(bob, `users/${ALICE}/profile/main`), { a: 1 }));
    await assertSucceeds(setDoc(doc(bob, `users/${BOB}/profile/main`), { a: 1 }));
  });

  it('reaches arbitrarily deep subcollections', async () => {
    const deep = `users/${ALICE}/days/2026-09-21/notes/n1/replies/r1`;
    await assertSucceeds(setDoc(doc(alice, deep), { value: 1 }));
    await assertFails(getDoc(doc(bob, deep)));
  });

  it('does not treat a uid prefix as a match', async () => {
    // A uid that merely starts with another must not gain access.
    const impostor = testEnv.authenticatedContext(`${ALICE}-extra`).firestore();
    await assertFails(getDoc(doc(impostor, `users/${ALICE}/profile/main`)));
  });
});

describe('the rules file', () => {
  it('denies by default rather than allowing by default', () => {
    const rules = readFileSync(
      new URL('../../firestore.rules', import.meta.url),
      'utf8',
    );
    assert.match(rules, /allow read, write: if false/);
  });
});

const mobileAnswers = {
  age: '25–34', sex: 'Female', heightCm: '165', currentWeightKg: '72.5',
  primaryGoal: 'Build consistent habits', targetWeightKg: '68',
  weeklyPace: 'Steady · 0.5 kg a week', outcome: 'Cook at home',
  activity: 'Moderately active', diet: 'No specific diet', allergies: ['None known'],
};
const mobileRecord = (answers = mobileAnswers, revision = 1) => ({
  schemaVersion: 1, revision, generation: 'abcdefghijklmnopqrst', updatedAt: serverTimestamp(),
  profile: { version: 2, updatedAt: '2026-10-08T12:00:00.000Z', answers },
});
const verified = (uid = ALICE) => testEnv.authenticatedContext(uid, { email_verified: true }).firestore();
describe('mobile onboarding profiles', () => {
  it('allows a verified owner to create, read, advance revision and delete', async () => {
    const ref = doc(verified(), `mobileProfiles/${ALICE}`);
    await assertSucceeds(setDoc(ref, mobileRecord()));
    await assertSucceeds(getDoc(ref));
    await assertSucceeds(setDoc(ref, mobileRecord({ ...mobileAnswers, outcome: 'Walk daily' }, 2)));
    await assertSucceeds(deleteDoc(ref));
  });
  it('rejects unsigned, unverified and other verified accounts', async () => {
    const path = `mobileProfiles/${ALICE}`;
    await assertSucceeds(setDoc(doc(verified(), path), mobileRecord()));
    for (const client of [anonymous, alice, verified(BOB)]) {
      await assertFails(getDoc(doc(client, path)));
      await assertFails(setDoc(doc(client, path), mobileRecord()));
      await assertFails(deleteDoc(doc(client, path)));
    }
  });
  it('rejects unknown fields, missing required answers and malformed choices', async () => {
    const ref = doc(verified(), `mobileProfiles/${ALICE}`);
    const missing = { ...mobileAnswers }; delete missing.age;
    for (const answers of [missing, { ...mobileAnswers, admin: true },
      { ...mobileAnswers, outcome: 'x'.repeat(301) }, { ...mobileAnswers, activity: 'invented' },
      { ...mobileAnswers, allergies: ['Milk', 'None known'] },
      { ...mobileAnswers, heightCm: '90' }, { ...mobileAnswers, currentWeightKg: '24' },
      { ...mobileAnswers, targetWeightKg: '400' },
      { ...mobileAnswers, diet: 'Other' }]) {
      await assertFails(setDoc(ref, mobileRecord(answers)));
    }
    await assertFails(setDoc(ref, { ...mobileRecord(), extra: true }));
    await assertFails(setDoc(ref, { ...mobileRecord(), updatedAt: new Date('2020-01-01') }));
  });
  it('requires revision one on creation and exactly one increment on update', async () => {
    const ref = doc(verified(), `mobileProfiles/${ALICE}`);
    await assertFails(setDoc(ref, mobileRecord(mobileAnswers, 7)));
    await assertSucceeds(setDoc(ref, mobileRecord()));
    await assertFails(setDoc(ref, mobileRecord()));
    await assertFails(setDoc(ref, mobileRecord(mobileAnswers, 3)));
  });
  it('accepts conditional diet and allergy details and maintain-weight without a pace', async () => {
    const ref = doc(verified(), `mobileProfiles/${ALICE}`);
    await assertSucceeds(setDoc(ref, mobileRecord({ ...mobileAnswers,
      diet: 'Other', dietOther: 'My preference',
      allergies: ['Other'], allergyOther: 'Test allergy',
    })));
    await assertSucceeds(deleteDoc(ref));
    const maintain = { ...mobileAnswers, targetWeightKg: '72.5' };
    delete maintain.weeklyPace;
    await assertSucceeds(setDoc(ref, mobileRecord(maintain)));
  });
});

describe('mobile meal prep backups', () => {
  const record = (revision = 1) => ({ schemaVersion: 1, revision, generation: 'a'.repeat(20), payload: JSON.stringify({version:1,batches:[],checked:[]}), updatedAt: serverTimestamp() });
  const verified = () => testEnv.authenticatedContext(ALICE, {email_verified:true}).firestore();
  it('allows a verified owner to save and read a plan', async () => {
    const ref=doc(verified(),'mobileMealPrep',ALICE);
    await assertSucceeds(setDoc(ref,record()));await assertSucceeds(getDoc(ref));
  });
  it('denies other accounts, anonymous sessions and unverified owners', async () => {
    await assertSucceeds(setDoc(doc(verified(),'mobileMealPrep',ALICE),record()));
    for (const db of [bob,anonymous,alice]) {
      await assertFails(getDoc(doc(db,'mobileMealPrep',ALICE)));
      await assertFails(setDoc(doc(db,'mobileMealPrep',ALICE),record(2)));
    }
  });
  it('enforces monotonic revisions and an immutable generation',async()=>{
    const ref=doc(verified(),'mobileMealPrep',ALICE);await assertSucceeds(setDoc(ref,record()));
    await assertFails(setDoc(ref,record()));await assertFails(setDoc(ref,record(3)));
    await assertFails(setDoc(ref,{...record(2),generation:'b'.repeat(20)}));
    await assertSucceeds(setDoc(ref,record(2)));
  });
  it('rejects oversized payloads, unsupported schemas, unknown fields and forged timestamps',async()=>{
    const ref=doc(verified(),'mobileMealPrep',ALICE);
    for (const change of [{payload:'x'.repeat(180001)},{payload:{}},{schemaVersion:2},{extra:true},{updatedAt:new Date(0)},{generation:'bad'},{revision:2}]) await assertFails(setDoc(ref,{...record(),...change}));
  });
});
