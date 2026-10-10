import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { initializePersistentAuth } from "./auth-persistence";

// Public Firebase web-app identifiers. Authorization comes from Auth and rules.
const config = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};
export const cloudConfigured = Object.values(config).every(Boolean);
const name = "fitness360-profile";

export function firebaseClient() {
  if (!cloudConfigured)
    throw new Error("Firebase has not been configured for this build.");
  const exists = getApps().some((app) => app.name === name);
  const app = exists ? getApp(name) : initializeApp(config, name);
  let auth;
  try {
    auth = initializePersistentAuth(app);
  } catch (error) {
    if ((error as { code?: string }).code !== "auth/already-initialized")
      throw error;
    auth = getAuth(app);
  }
  return { app, auth, db: getFirestore(app) };
}
