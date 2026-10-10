import { parsePrepSuggestion } from "../domain/meal-prep";
import type { LabelConnection } from "./label-reader";
export type PrepInput = {
  description: string;
  servings: number;
  preferences?: string;
};
export function createPrepReader(
  connect: () => Promise<LabelConnection>,
  fetcher: typeof fetch = fetch,
  timeoutMs = 40000,
) {
  return async (input: PrepInput, signal: AbortSignal) => {
    const controller = new AbortController();
    const abort = () => controller.abort();
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) controller.abort();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);
    // Auth/App Check initialization can outlive an aborted screen; never submit after cancellation.
    const check = () => {
      if (controller.signal.aborted)
        throw new Error(
          timedOut
            ? "Recipe analysis timed out. Try again."
            : "Recipe analysis cancelled.",
        );
    };
    try {
      check();
      const connection = await Promise.race([
        connect(),
        new Promise<never>((_, reject) =>
          controller.signal.addEventListener(
            "abort",
            () =>
              reject(
                new Error(
                  timedOut
                    ? "Recipe analysis timed out."
                    : "Recipe analysis cancelled.",
                ),
              ),
            { once: true },
          ),
        ),
      ]);
      check();
      const response = await fetcher(connection.url, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...connection.headers },
        body: JSON.stringify({ data: input }),
        signal: controller.signal,
      });
      const body = await response.json();
      check();
      if (!response.ok || body?.error) {
        if (
          response.status === 429 ||
          body?.error?.status === "RESOURCE_EXHAUSTED"
        )
          throw new Error(
            "AI usage limit reached. Try again later or use a saved meal.",
          );
        if (response.status === 401 || response.status === 403)
          throw new Error(
            "App verification failed. Use a configured phone build.",
          );
        if (body?.error?.status === "FAILED_PRECONDITION")
          throw new Error(
            "Recipe AI needs server configuration. Saved meals still work.",
          );
        throw new Error(
          "Couldn’t analyse this recipe. Try a clearer description or use a saved meal.",
        );
      }
      return parsePrepSuggestion(body.result);
    } catch (cause) {
      check();
      if (cause instanceof TypeError)
        throw new Error(
          "Couldn’t reach recipe AI. Check your connection and try again.",
        );
      throw cause;
    } finally {
      clearTimeout(timer);
      signal.removeEventListener("abort", abort);
    }
  };
}
