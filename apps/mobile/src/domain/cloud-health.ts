import { HealthProfile, validateHealthProfile } from "./health";

export type CloudHealth = {
  schemaVersion: 1;
  revision: number;
  generation: string;
  health: HealthProfile;
};

/** Messages stay generic so health answers never appear in error text. */
export function parseCloudHealth(value: unknown): CloudHealth {
  if (!value || typeof value !== "object")
    throw new Error("Saved health backup could not be opened.");
  const data = value as CloudHealth & { backupConsent?: unknown };
  if (
    data.schemaVersion !== 1 ||
    !Number.isSafeInteger(data.revision) ||
    data.revision < 1 ||
    typeof data.generation !== "string" ||
    !/^[A-Za-z0-9]{20}$/.test(data.generation) ||
    data.backupConsent !== true
  )
    throw new Error("Saved health backup could not be opened.");
  validateHealthProfile(data.health);
  return {
    schemaVersion: 1,
    revision: data.revision,
    generation: data.generation,
    health: data.health,
  };
}
