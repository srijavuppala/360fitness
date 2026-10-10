import { browserLocalPersistence, initializeAuth } from "firebase/auth";
import type { FirebaseApp } from "firebase/app";

export function initializePersistentAuth(app: FirebaseApp) {
  return initializeAuth(app, { persistence: browserLocalPersistence });
}
