import { signInAnonymously } from "firebase/auth";
import { firebaseClient } from "./cloud/firebase";
import type { LabelConnection } from "./label-reader";

export const labelAiAvailable =
  process.env.EXPO_PUBLIC_LABEL_AI_ENABLED === "true";
let appCheckInstance:
  import("@react-native-firebase/app-check").AppCheck | null = null;
let session: Promise<LabelConnection> | null = null;

async function connect(): Promise<LabelConnection> {
  if (!labelAiAvailable)
    throw new Error(
      "Photo AI needs Firebase setup and a new phone build. Manual entry is available now.",
    );
  try {
    const [appModule, checkModule] = await Promise.all([
      import("@react-native-firebase/app"),
      import("@react-native-firebase/app-check"),
    ]);
    const app = appModule.getApp();
    const provider = new checkModule.ReactNativeFirebaseAppCheckProvider();
    // Production attestation only; never ship a public debug bypass token.
    provider.configure({
      android: { provider: "playIntegrity" },
      apple: { provider: "appAttestWithDeviceCheckFallback" },
    });
    const appCheck = (appCheckInstance ??= checkModule.initializeAppCheck(app, {
      provider,
      isTokenAutoRefreshEnabled: false,
    }));
    const attestation = await checkModule.getToken(appCheck);
    const { auth, app: accountApp } = firebaseClient();
    if (accountApp.options.projectId !== app.options.projectId)
      throw new Error("Firebase projects must match");
    await auth.authStateReady();
    const user = auth.currentUser ?? (await signInAnonymously(auth)).user;
    const token = await user.getIdToken();
    const project = app.options.projectId;
    if (!project || !/^[a-z0-9-]+$/.test(project))
      throw new Error("Missing project");
    return {
      url: `https://us-central1-${project}.cloudfunctions.net/analyzeLabelCallable`,
      headers: {
        Authorization: `Bearer ${token}`,
        "X-Firebase-AppCheck": attestation.token,
      },
    };
  } catch {
    throw new Error(
      "Photo AI could not verify this app. Check Firebase client configuration, sign-in and App Check setup, then install a configured phone build.",
    );
  }
}

export async function labelConnection(): Promise<LabelConnection> {
  // Deduplicate concurrent setup, but obtain current auth/attestation tokens for each scan.
  if (!session)
    session = connect().finally(() => {
      session = null;
    });
  return session;
}

export async function mealPhotoConnection(): Promise<LabelConnection> {
  const connection = await labelConnection();
  return {
    ...connection,
    url: connection.url
      .replace(/analyzeLabelCallable$/, "analyzeMealPhotoCallable")
      .replace(/analyze-label$/, "analyze-meal-photo"),
  };
}
