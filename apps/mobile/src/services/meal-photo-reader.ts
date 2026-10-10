import { MealPhotoResult, parseMealPhoto } from "../domain/meal-photo";
import { MEAL_PHOTO_REQUEST_TEXT } from "../domain/meal-photo-request";
import type { LabelImage } from "./label-reader";

export type MealPhotoGenerate = (request: {
  image: LabelImage;
  text: string;
  signal: AbortSignal;
}) => Promise<string>;

const unrecognized =
  "This meal could not be recognized. Try a clear photo of the whole plate or add foods manually.";

function friendlyError(error: unknown): Error {
  const code = String((error as { code?: unknown })?.code ?? "");
  const status = (error as { customErrorData?: { status?: number } })
    ?.customErrorData?.status;
  const message = error instanceof Error ? error.message : "";
  if (
    code.endsWith("api-not-enabled") ||
    /genai config not found|API has not been used|is disabled/i.test(message)
  )
    return new Error(
      "Firebase AI Logic is not set up for this project yet. Open Firebase Console → AI Logic → Get started. Manual entry still works.",
    );
  if (status === 429)
    return new Error(
      "Photo analysis limit reached. Wait a minute, or enter foods manually.",
    );
  if (code.endsWith("response-error") || code.endsWith("parse-failed"))
    return new Error(unrecognized);
  // fetch-error with an HTTP status means the service answered; only a missing status is a network failure.
  if (
    error instanceof TypeError ||
    (code.endsWith("fetch-error") && status === undefined)
  )
    return new Error(
      "Couldn’t connect to photo AI. Check the connection and try again.",
    );
  return new Error(
    "Photo AI is temporarily unavailable. Try again or enter foods manually.",
  );
}

/** Calls Gemini through Firebase AI Logic, then applies the same validation as the server path. */
export function createAiLogicMealReader(
  generate: MealPhotoGenerate,
  timeoutMs = 40000,
) {
  return async (
    image: LabelImage,
    signal?: AbortSignal,
  ): Promise<MealPhotoResult> => {
    if (!image.base64 || image.base64.length > 5592408)
      throw new Error("Choose a smaller photo.");
    const controller = new AbortController();
    let timedOut = false;
    const abort = () => controller.abort();
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) controller.abort();
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);
    try {
      if (controller.signal.aborted) throw new Error("cancelled");
      const reply = await generate({
        image,
        text: MEAL_PHOTO_REQUEST_TEXT,
        signal: controller.signal,
      });
      let raw: unknown;
      try {
        raw = JSON.parse(reply);
      } catch {
        throw new Error(unrecognized);
      }
      return parseMealPhoto(raw);
    } catch (error) {
      if (timedOut)
        throw new Error(
          "Photo analysis timed out. Try again or enter foods manually.",
        );
      if (controller.signal.aborted)
        throw new Error("Photo analysis cancelled.");
      if (
        error instanceof Error &&
        (error.message === unrecognized || /incomplete/.test(error.message))
      )
        throw error;
      throw friendlyError(error);
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
    }
  };
}
