import { PersonalProfile, validateProfile } from "./profile";

export type CloudProfile = {
  schemaVersion: 1;
  revision: number;
  generation: string;
  profile: PersonalProfile;
};
export function parseCloudProfile(value: unknown): CloudProfile {
  if (!value || typeof value !== "object")
    throw new Error("Invalid cloud profile.");
  const data = value as CloudProfile;
  if (
    data.schemaVersion !== 1 ||
    !Number.isSafeInteger(data.revision) ||
    data.revision < 1 ||
    typeof data.generation !== "string" ||
    !/^[A-Za-z0-9]{20}$/.test(data.generation)
  )
    throw new Error("This cloud profile needs a newer app version.");
  validateProfile(data.profile);
  return {
    schemaVersion: 1,
    revision: data.revision,
    generation: data.generation,
    profile: data.profile,
  };
}
export function assertRevision(actual: number, expected: number) {
  if (actual !== expected)
    throw new Error(
      "Your cloud profile changed on another device. Review the latest version before saving again.",
    );
}

export function assertGeneration(
  actual: string | null,
  expected: string | null,
) {
  if (actual !== expected)
    throw new Error(
      "Your cloud profile changed on another device. Review the latest version before saving again.",
    );
}
