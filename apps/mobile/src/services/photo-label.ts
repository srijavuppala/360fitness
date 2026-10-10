import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { fetch } from "expo/fetch";
import { createLabelReader } from "./label-reader";
import { labelConnection } from "./label-connection";
export { labelAiAvailable } from "./label-connection";

export type LabelPhotoAsset = { uri: string; width: number; height: number };
const read = createLabelReader(
  fetch as typeof globalThis.fetch,
  labelConnection,
);

export async function preparePhoto(
  photo: LabelPhotoAsset,
  signal: AbortSignal,
) {
  if (signal.aborted) throw new Error("Photo analysis cancelled.");
  const context = ImageManipulator.manipulate(photo.uri);
  if (Math.max(photo.width, photo.height) > 1600)
    context.resize(
      photo.width >= photo.height ? { width: 1600 } : { height: 1600 },
    );
  const rendered = await context.renderAsync();
  const image = await rendered.saveAsync({
    format: SaveFormat.JPEG,
    compress: 0.85,
    base64: true,
  });
  if (signal.aborted) throw new Error("Photo analysis cancelled.");
  if (!image.base64)
    throw new Error("This photo could not be prepared. Choose another image.");
  return { mimeType: "image/jpeg" as const, base64: image.base64 };
}

export async function readPhotoLabel(
  photo: LabelPhotoAsset,
  signal: AbortSignal,
) {
  return read(await preparePhoto(photo, signal), signal);
}
