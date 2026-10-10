import { initializeApp } from "firebase/app";
import {
  initializeAppCheck,
  ReCaptchaEnterpriseProvider,
} from "firebase/app-check";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  reauthenticateWithPopup,
  type User,
} from "firebase/auth";
import {
  getFirestore,
  collection,
  onSnapshot,
  writeBatch,
  doc,
} from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { changedRecords, stateFromRecords, type WebState } from "./model";

const app = initializeApp({
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
});
initializeAppCheck(app, {
  provider: new ReCaptchaEnterpriseProvider(
    import.meta.env.VITE_RECAPTCHA_ENTERPRISE_SITE_KEY,
  ),
  isTokenAutoRefreshEnabled: true,
});
const auth = getAuth(app),
  db = getFirestore(app),
  functions = getFunctions(app, "us-central1");
export const watchAuth = (callback: (user: User | null) => void) =>
  onAuthStateChanged(auth, callback);
export const login = () => signInWithPopup(auth, new GoogleAuthProvider());
export const logout = () => signOut(auth);
export function watchRecords(
  uid: string,
  onData: (state: WebState) => void,
  onError: (error: Error) => void,
) {
  return onSnapshot(
    collection(db, "users", uid, "webRecords"),
    (snapshot) => {
      try {
        onData(stateFromRecords(snapshot.docs.map((d) => d.data())));
      } catch (error) {
        onError(error as Error);
      }
    },
    onError,
  );
}
export async function saveChanges(
  uid: string,
  before: WebState,
  after: WebState,
) {
  const changes = changedRecords(before, after);
  if (changes.length > 450)
    throw new Error(
      "This operation changes too many records at once. Export your data and contact support.",
    );
  const batch = writeBatch(db);
  for (const { key, value } of changes) {
    const ref = doc(db, "users", uid, "webRecords", key);
    if (value === null) batch.delete(ref);
    else batch.set(ref, value as Record<string, unknown>);
  }
  await batch.commit();
}
export async function analyze(text: string, slot: string) {
  return (
    await httpsCallable(
      functions,
      "parseMealCallable",
    )({ text, slot: slot.toLowerCase() })
  ).data;
}
export async function removeAccount() {
  if (!auth.currentUser) throw new Error("Sign in first.");
  await reauthenticateWithPopup(auth.currentUser, new GoogleAuthProvider());
  await httpsCallable(functions, "deleteAccount")({});
  await signOut(auth);
}
