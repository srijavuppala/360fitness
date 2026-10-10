import AsyncStorage from "@react-native-async-storage/async-storage";
import { getReactNativePersistence, initializeAuth } from "firebase/auth";
import type { FirebaseApp } from "firebase/app";

export function initializePersistentAuth(app: FirebaseApp) {
  return initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
}
