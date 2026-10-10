import {
  getAI,
  getGenerativeModel,
  GoogleAIBackend,
  ThinkingLevel,
  type GenerativeModel,
  type SchemaRequest,
} from "firebase/ai";
import {
  MEAL_PHOTO_INSTRUCTIONS,
  MEAL_PHOTO_SCHEMA,
} from "../domain/meal-photo-request";
import { cloudConfigured, firebaseClient } from "./cloud/firebase";
import type { MealPhotoGenerate } from "./meal-photo-reader";

// Spark-plan path: Gemini via the Firebase AI Logic proxy; no provider key in the app.
// Without App Check (Expo Go) it relies on AI Logic's per-user rate limits.
export const aiLogicMealPhotoEnabled =
  process.env.EXPO_PUBLIC_MEAL_PHOTO_AI_LOGIC === "true" && cloudConfigured;

let model: GenerativeModel | null = null;

export const generateWithAiLogic: MealPhotoGenerate = async ({
  image,
  text,
  signal,
}) => {
  model ??= getGenerativeModel(
    getAI(firebaseClient().app, { backend: new GoogleAIBackend() }),
    {
      model: "gemini-3.8-flash",
      systemInstruction: MEAL_PHOTO_INSTRUCTIONS,
      generationConfig: {
        // Gemini 3 hangs with temperature 0 (keep its default 1.0); LOW thinking keeps replies near 8 s.
        maxOutputTokens: 4096,
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        responseMimeType: "application/json",
        responseSchema: MEAL_PHOTO_SCHEMA as unknown as SchemaRequest,
      },
    },
  );
  const result = await model.generateContent(
    [
      {
        type: "inlineData",
        inlineData: { mimeType: image.mimeType, data: image.base64 },
      },
      { type: "text", text },
    ],
    { signal },
  );
  return result.response.text();
};
