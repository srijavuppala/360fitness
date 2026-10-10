import type { LabelBasis, LabelFields } from "../domain/label-entry";

export type LabelExtraction = {
  name: string | null;
  basis: LabelBasis | null;
  servingDescription: string | null;
  energyUnit: "kcal" | "kJ" | null;
  fields: LabelFields;
  uncertainFields: string[];
};
export type LabelImage = { mimeType: "image/jpeg"; base64: string };
export type LabelConnection = { url: string; headers: Record<string, string> };

export function parseLabelExtraction(raw: unknown): LabelExtraction {
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    throw new Error(
      "The label result could not be read. Please try another photo.",
    );
  const data = raw as Record<string, unknown>;
  if (
    !data.nutrients ||
    typeof data.nutrients !== "object" ||
    Array.isArray(data.nutrients) ||
    !Array.isArray(data.uncertainFields)
  )
    throw new Error(
      "The label result is incomplete. Enter the values manually or try again.",
    );
  const uncertain = new Set<string>(
    data.uncertainFields.filter(
      (value): value is string =>
        typeof value === "string" && value.length < 40,
    ),
  );
  const nutrients = data.nutrients as Record<string, unknown>;
  const basis =
    !uncertain.has("basis") &&
    ["100g", "100ml", "serving"].includes(String(data.basis))
      ? (data.basis as LabelBasis)
      : null;
  const energyUnit =
    !uncertain.has("energyUnit") &&
    (data.energyUnit === "kcal" || data.energyUnit === "kJ")
      ? data.energyUnit
      : null;
  const fields: LabelFields = { kcal: "", protein: "", carbs: "", fat: "" };
  for (const [field, source] of [
    ["kcal", "energy"],
    ["protein", "protein"],
    ["carbs", "carbs"],
    ["fat", "fat"],
  ] as const) {
    const value = nutrients[source];
    const max =
      field === "kcal"
        ? energyUnit === "kJ"
          ? 41840
          : 10000
        : basis === "100g"
          ? 100
          : 10000;
    if (
      basis &&
      (field !== "kcal" || energyUnit) &&
      !uncertain.has(source) &&
      typeof value === "number" &&
      Number.isFinite(value) &&
      value >= 0 &&
      value <= max
    )
      fields[field] = String(value);
    else uncertain.add(source);
  }
  const text = (key: string, max: number) =>
    !uncertain.has(key) &&
    typeof data[key] === "string" &&
    data[key].length <= max
      ? data[key].trim() || null
      : null;
  return {
    name: text("name", 100),
    basis,
    servingDescription: text("servingDescription", 200),
    energyUnit,
    fields,
    uncertainFields: [...uncertain],
  };
}

function cancellable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => reject(new Error("cancelled"));
    if (signal.aborted) return abort();
    signal.addEventListener("abort", abort, { once: true });
    promise
      .then(resolve, reject)
      .finally(() => signal.removeEventListener("abort", abort));
  });
}

export function createPhotoReader<T>(
  fetcher: typeof fetch,
  connect: () => Promise<LabelConnection>,
  parse: (raw: unknown) => T,
  timeoutMs = 40000,
  kind: "label" | "meal" = "label",
) {
  return async (image: LabelImage, signal?: AbortSignal): Promise<T> => {
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
      const connection = await cancellable(connect(), controller.signal);
      if (controller.signal.aborted) throw new Error("cancelled");
      const response = await cancellable(
        fetcher(connection.url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...connection.headers,
          },
          body: JSON.stringify({ data: image }),
          signal: controller.signal,
        }),
        controller.signal,
      );
      const body = await cancellable(
        response.json().catch(() => null),
        controller.signal,
      );
      if (!response.ok || body?.error) {
        const code = body?.error?.status;
        if (response.status === 429 || code === "RESOURCE_EXHAUSTED")
          throw new Error(
            "Photo analysis limit reached. Wait a minute, or enter foods manually.",
          );
        if (response.status === 401 || response.status === 403)
          throw new Error(
            "App verification failed. Use a configured phone build and try again.",
          );
        if (code === "FAILED_PRECONDITION")
          throw new Error(
            "Photo AI needs server configuration. Add the Gemini key on the server, then try again. Manual entry still works.",
          );
        if (code === "INVALID_ARGUMENT" || code === "DATA_LOSS")
          throw new Error(
            kind === "meal"
              ? "This meal could not be recognized. Try a clear photo of the whole plate or add foods manually."
              : "This label could not be read. Try a clear, close-up photo of one nutrition panel.",
          );
        throw new Error(
          "Photo AI is temporarily unavailable. Try again or enter the values manually.",
        );
      }
      return parse(body?.result);
    } catch (error) {
      if (timedOut)
        throw new Error(
          "Photo analysis timed out. Try again or enter the values manually.",
        );
      if (controller.signal.aborted)
        throw new Error("Photo analysis cancelled.");
      if (error instanceof TypeError)
        throw new Error(
          "Couldn’t connect to photo AI. Check the connection and that the AI server is running.",
        );
      throw error;
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
    }
  };
}

export function createLabelReader(
  fetcher: typeof fetch,
  connect: () => Promise<LabelConnection>,
  timeoutMs = 40000,
) {
  return createPhotoReader(fetcher, connect, parseLabelExtraction, timeoutMs);
}
