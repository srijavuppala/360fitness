import { fetch } from "expo/fetch";
import { createProductLookup } from "./product-lookup";
export const lookupProduct = createProductLookup((url, options) =>
  fetch(url, {
    ...options,
    headers: {
      ...options?.headers,
      ...(process.env.EXPO_OS !== "web"
        ? { "User-Agent": "Fitness360/0.1 (Expo barcode scanner)" }
        : {}),
    },
  }),
);
