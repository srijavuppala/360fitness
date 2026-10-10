import {
  normalizeBarcode,
  parseProduct,
  type Product,
} from "../domain/product-scan";
export type LookupResult = {
  product: Product;
  fetchedAt: number;
  cached: boolean;
};
const fields =
  "code,product_name,product_name_en,brands,ingredients_text,ingredients_text_en,allergens_tags,traces_tags,nutriments,nutriscore_grade,nutrition_grades,nova_group,nutrient_levels,serving_size";

export function createProductLookup(
  fetcher: typeof fetch,
  now = Date.now,
  timeoutMs = 12000,
) {
  const cache = new Map<string, Omit<LookupResult, "cached">>();
  return async function lookup(
    raw: string,
    signal?: AbortSignal,
  ): Promise<LookupResult> {
    const barcode = normalizeBarcode(raw);
    if (signal?.aborted) throw new Error("Lookup cancelled.");
    const saved = cache.get(barcode);
    if (saved && now() - saved.fetchedAt < 10 * 60 * 1000)
      return { ...saved, cached: true };
    const controller = new AbortController();
    const cancel = () => controller.abort();
    signal?.addEventListener("abort", cancel, { once: true });
    const timeout = setTimeout(cancel, timeoutMs);
    try {
      const response = await fetcher(
        `https://world.openfoodfacts.org/api/v2/product/${barcode}.json?fields=${fields}&app_name=Fitness360&app_version=0.1`,
        {
          signal: controller.signal,
          headers: { Accept: "application/json" },
        },
      );
      if (response.status === 404)
        throw new Error(
          "Product not found. Try the printed barcode or enter this food manually.",
        );
      if (response.status === 429)
        throw new Error(
          "The product service is busy. Wait a minute before trying again.",
        );
      if (!response.ok)
        throw new Error(
          "The product service is unavailable. Try again later or enter the food manually.",
        );
      const result = {
        product: parseProduct(await response.json(), barcode),
        fetchedAt: now(),
      };
      if (controller.signal.aborted) throw new Error("Lookup cancelled.");
      if (cache.size >= 100) cache.delete(cache.keys().next().value!);
      cache.set(barcode, result);
      return { ...result, cached: false };
    } catch (error) {
      if (controller.signal.aborted)
        throw new Error(
          signal?.aborted
            ? "Lookup cancelled."
            : "Lookup timed out. Check your connection and try again.",
        );
      if (error instanceof TypeError)
        throw new Error(
          "Could not connect to Open Food Facts. Check your connection or enter the food manually.",
        );
      if (error instanceof SyntaxError)
        throw new Error(
          "The product service returned unreadable data. Try again later.",
        );
      throw error;
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", cancel);
    }
  };
}
