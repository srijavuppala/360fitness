import { fetch } from "expo/fetch";
import { labelConnection } from "./label-connection";
import { createPrepReader } from "./prep-reader";
export { labelAiAvailable as prepAiAvailable } from "./label-connection";
export const analysePrep = createPrepReader(
  async () => {
    const connection = await labelConnection();
    return {
      ...connection,
      url: connection.url
        .replace(/analyzeLabelCallable$/, "analyzeMealPrepCallable")
        .replace(/analyze-label$/, "analyze-meal-prep"),
    };
  },
  fetch as typeof globalThis.fetch,
);
