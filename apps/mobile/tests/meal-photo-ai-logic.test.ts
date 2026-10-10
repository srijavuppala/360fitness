import assert from "node:assert/strict";
import { test } from "node:test";
import {
  MEAL_PHOTO_INSTRUCTIONS,
  MEAL_PHOTO_REQUEST_TEXT,
  MEAL_PHOTO_SCHEMA,
} from "../src/domain/meal-photo-request";
import { createAiLogicMealReader } from "../src/services/meal-photo-reader";

const image = { mimeType: "image/jpeg" as const, base64: "abc123" };
const result = {
  status: "food",
  name: "Rice plate",
  foods: [
    {
      name: "Rice",
      quantity: 1,
      unit: "cup",
      portionNote: "Cooked rice; no scale reference.",
      uncertain: true,
      nutrition: { kcal: 200, protein: 4, carbs: 44, fat: 0.4 },
    },
  ],
};

test("phone request matches the reviewed server prompt and schema exactly", async () => {
  // Path held in a variable so the app's type check does not compile backend sources.
  const serverModule = "../../../functions/src/mealPhotoAnalysis.js";
  const server = await import(serverModule);
  const body = server.buildMealPhotoRequest(image);
  assert.equal(MEAL_PHOTO_INSTRUCTIONS, body.systemInstruction.parts[0].text);
  assert.equal(MEAL_PHOTO_REQUEST_TEXT, body.contents[0].parts[1].text);
  assert.deepEqual(MEAL_PHOTO_SCHEMA, server.MEAL_PHOTO_SCHEMA);
});

test("AI Logic reader sends the photo and validates the reply", async () => {
  let sent: unknown;
  const read = createAiLogicMealReader(async (request) => {
    sent = request;
    return JSON.stringify(result);
  });
  assert.deepEqual(await read(image), result);
  assert.deepEqual(sent, {
    image,
    text: MEAL_PHOTO_REQUEST_TEXT,
    signal: (sent as { signal: AbortSignal }).signal,
  });
});

test("AI Logic reader rejects malformed or invented output", async () => {
  for (const reply of [
    "not json",
    JSON.stringify({ status: "food", name: "x", foods: [] }),
    JSON.stringify({ ...result, status: "no_food" }),
  ])
    await assert.rejects(
      createAiLogicMealReader(async () => reply)(image),
      /could not be recognized|incomplete/,
    );
});

test("AI Logic errors become actionable messages", async () => {
  const cases: [unknown, RegExp][] = [
    [
      Object.assign(new Error("x"), { code: "AI/api-not-enabled" }),
      /AI Logic is not set up/,
    ],
    [
      // Live response before Console → AI Logic → Get started.
      Object.assign(
        new Error(
          "[400 Bad Request] Firebase AI Logic genai config not found.",
        ),
        { code: "AI/fetch-error", customErrorData: { status: 400 } },
      ),
      /AI Logic is not set up/,
    ],
    [
      Object.assign(new Error("x"), {
        code: "AI/fetch-error",
        customErrorData: { status: 500 },
      }),
      /temporarily unavailable/,
    ],
    [
      Object.assign(new Error("x"), {
        code: "AI/fetch-error",
        customErrorData: { status: 429 },
      }),
      /limit reached/,
    ],
    [
      Object.assign(new Error("x"), { code: "AI/response-error" }),
      /could not be recognized/,
    ],
    [new TypeError("Network request failed"), /Couldn’t connect/],
  ];
  for (const [error, message] of cases)
    await assert.rejects(
      createAiLogicMealReader(async () => {
        throw error;
      })(image),
      message,
    );
});

test("AI Logic reader honours cancel and timeout", async () => {
  const hang = (request: { signal: AbortSignal }) =>
    new Promise<string>((_, reject) =>
      request.signal.addEventListener("abort", () =>
        reject(new Error("aborted")),
      ),
    );
  const controller = new AbortController();
  const pending = createAiLogicMealReader(hang)(image, controller.signal);
  controller.abort();
  await assert.rejects(pending, /cancelled/);
  await assert.rejects(createAiLogicMealReader(hang, 20)(image), /timed out/);
  await assert.rejects(
    createAiLogicMealReader(async () => "{}")({ ...image, base64: "" }),
    /smaller photo/,
  );
});
