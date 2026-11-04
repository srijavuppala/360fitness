import {
  FoodCandidate,
  mapOffHit,
  parseCandidates,
} from "../domain/food-search";
import type { LabelConnection } from "./label-reader";

export type SearchRoute = "server" | "direct" | "unavailable";
export type SearchOutcome = { results: FoodCandidate[]; route: SearchRoute };

const OFF_SEARCH = "https://search.openfoodfacts.org/search";
const OFF_FIELDS = "code,product_name,product_name_en,brands,nutriments";

export function createFoodSearch({
  fetcher,
  route,
  connect,
  timeoutMs = 10000,
}: {
  fetcher: typeof fetch;
  route: SearchRoute;
  connect?: () => Promise<LabelConnection>;
  timeoutMs?: number;
}) {
  async function direct(query: string, signal: AbortSignal) {
    const url = `${OFF_SEARCH}?q=${encodeURIComponent(query)}&page_size=20&fields=${OFF_FIELDS}`;
    const response = await fetcher(url, {
      signal,
      headers: { Accept: "application/json" },
    });
    if (!response.ok) throw new Error("search failed");
    const body = (await response.json()) as { hits?: unknown };
    if (!Array.isArray(body.hits)) throw new Error("search failed");
    return body.hits
      .map(mapOffHit)
      .filter((hit): hit is FoodCandidate => hit !== null);
  }

  async function server(query: string, signal: AbortSignal) {
    if (!connect) throw new Error("no connection");
    const connection = await connect();
    const response = await fetcher(
      connection.url.replace(/analyzeLabelCallable$/, "searchFoodsCallable"),
      {
        method: "POST",
        headers: { "Content-Type": "application/json", ...connection.headers },
        body: JSON.stringify({ data: { query, limit: 20 } }),
        signal,
      },
    );
    const body = await response.json().catch(() => null);
    if (response.status === 429 || body?.error?.status === "RESOURCE_EXHAUSTED")
      throw new LimitError();
    if (!response.ok || body?.error) throw new Error("search failed");
    return parseCandidates(body?.result);
  }

  return async function search(
    raw: string,
    signal?: AbortSignal,
  ): Promise<SearchOutcome> {
    const query = raw.replace(/\s+/g, " ").trim();
    if (query.length < 2) return { results: [], route };
    if (route === "unavailable")
      throw new Error(
        "Food search runs in the phone app. In this browser preview, use your history or enter a food manually.",
      );
    const controller = new AbortController();
    const abort = () => controller.abort();
    signal?.addEventListener("abort", abort, { once: true });
    const timer = setTimeout(abort, timeoutMs);
    try {
      if (route === "server")
        try {
          return { results: await server(query, controller.signal), route };
        } catch (error) {
          if (error instanceof LimitError || controller.signal.aborted)
            throw error;
          // Server not deployed or verification failed: open data still works.
        }
      return {
        results: await direct(query, controller.signal),
        route: "direct",
      };
    } catch (error) {
      if (signal?.aborted) throw new Error("cancelled");
      if (error instanceof LimitError)
        throw new Error(
          "Search limit reached. Wait a minute, or enter the food manually.",
        );
      throw new Error(
        controller.signal.aborted
          ? "Search took too long. Check your connection and try again."
          : "Food search is unavailable right now. You can still enter a food manually.",
      );
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
    }
  };
}

class LimitError extends Error {}
