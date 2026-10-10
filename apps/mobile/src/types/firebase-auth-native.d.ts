import "firebase/auth";
import type { Persistence } from "firebase/auth";
import type AsyncStorage from "@react-native-async-storage/async-storage";

// Firebase 13's top-level declarations omit this RN-only export even though
// Metro resolves @firebase/auth to its documented react-native entry point.
// Signature matches @firebase/auth/dist/rn/src/platform_react_native/persistence/react_native.d.ts.
declare module "firebase/auth" {
  export function getReactNativePersistence(
    storage: typeof AsyncStorage,
  ): Persistence;
}
