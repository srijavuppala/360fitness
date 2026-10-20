import { Platform } from "react-native";
import Constants, { ExecutionEnvironment } from "expo-constants";
import type { SearchRoute } from "./food-search";

/**
 * Signed builds with Firebase configured use searchFoodsCallable (USDA + Open
 * Food Facts, App Check, quota). Expo Go has no App Check module, so it
 * searches Open Food Facts directly. Browsers cannot: that endpoint sends no
 * CORS headers.
 */
export function defaultRoute(): SearchRoute {
  if (Platform.OS === "web") return "unavailable";
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient)
    return "direct";
  return process.env.EXPO_PUBLIC_LABEL_AI_ENABLED === "true"
    ? "server"
    : "direct";
}
