import type { LabelConnection } from "./label-reader";
export const labelAiAvailable =
  __DEV__ &&
  typeof window !== "undefined" &&
  ["localhost", "127.0.0.1"].includes(window.location.hostname);
export async function labelConnection(): Promise<LabelConnection> {
  if (!labelAiAvailable)
    throw new Error(
      "Photo AI in the browser is available only in the local development preview. Use the configured phone app for production analysis.",
    );
  return {
    url: "http://127.0.0.1:8787/analyze-label",
    headers: { "X-Fitness-Label": "1" },
  };
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
