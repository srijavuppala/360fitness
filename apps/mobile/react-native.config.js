// Keep unconfigured demo builds usable without native Firebase project files.
// Set this build environment flag together with the app.config.ts plugins.
const enabled = process.env.EXPO_PUBLIC_LABEL_AI_ENABLED === "true";
module.exports = {
  dependencies: enabled
    ? {}
    : Object.fromEntries(
        ["app", "auth", "app-check"].map((name) => [
          `@react-native-firebase/${name}`,
          { platforms: { ios: null, android: null } },
        ]),
      ),
};
