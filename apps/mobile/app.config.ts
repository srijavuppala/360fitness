import type { ConfigContext, ExpoConfig } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => {
  if (process.env.EXPO_PUBLIC_LABEL_AI_ENABLED !== "true")
    return config as ExpoConfig;
  return {
    ...config,
    name: config.name ?? "360° Fitness AI",
    slug: config.slug ?? "fitness360",
    ios: {
      ...config.ios,
      googleServicesFile:
        process.env.GOOGLE_SERVICES_PLIST ?? "./GoogleService-Info.plist",
    },
    android: {
      ...config.android,
      googleServicesFile:
        process.env.GOOGLE_SERVICES_JSON ?? "./google-services.json",
    },
    plugins: [
      ...(config.plugins ?? []),
      "@react-native-firebase/app",
      "@react-native-firebase/auth",
      "@react-native-firebase/app-check",
      ["expo-build-properties", { ios: { useFrameworks: "dynamic" } }],
    ],
  };
};
