import { fetch } from "expo/fetch";
import { parseMealPhoto } from "../domain/meal-photo";
import { createPhotoReader } from "./label-reader";
import { labelAiAvailable, mealPhotoConnection } from "./label-connection";
import {
  aiLogicMealPhotoEnabled,
  generateWithAiLogic,
} from "./meal-photo-ai-logic";
import { createAiLogicMealReader } from "./meal-photo-reader";
import { LabelPhotoAsset, preparePhoto } from "./photo-label";

const read = createPhotoReader(
  fetch as typeof globalThis.fetch,
  mealPhotoConnection,
  parseMealPhoto,
  40000,
  "meal",
);
const readWithAiLogic = createAiLogicMealReader(generateWithAiLogic);

export const mealPhotoUsesAiLogic = aiLogicMealPhotoEnabled;
export const mealPhotoAiAvailable = aiLogicMealPhotoEnabled || labelAiAvailable;

export async function readMealPhoto(
  photo: LabelPhotoAsset,
  signal: AbortSignal,
) {
  const image = await preparePhoto(photo, signal);
  return aiLogicMealPhotoEnabled
    ? readWithAiLogic(image, signal)
    : read(image, signal);
}
