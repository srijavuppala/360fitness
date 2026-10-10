import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createLabelReader,
  parseLabelExtraction,
} from "../src/services/label-reader";
import { labelMeal } from "../src/domain/label-entry";

const result = {
  name: "Granola",
  basis: "serving",
  servingDescription: "40 g",
  energyUnit: "kcal",
  nutrients: { energy: 200, protein: 6, carbs: 24, fat: 8 },
  uncertainFields: [],
};
const image = { mimeType: "image/jpeg" as const, base64: "/9j/2Q==" };
const connection = async () => ({
  url: "https://test.invalid/analyzeLabelCallable",
  headers: {
    Authorization: "Bearer test-id-token",
    "X-Firebase-AppCheck": "test-attestation",
  },
});

test("AI label values become editable fields, preserve unknowns and scale once with AI attribution", () => {
  const parsed = parseLabelExtraction(result);
  assert.deepEqual(parsed.fields, {
    kcal: "200",
    protein: "6",
    carbs: "24",
    fat: "8",
  });
  const meal = labelMeal({
    name: parsed.name!,
    fields: parsed.fields,
    energyUnit: parsed.energyUnit!,
    basis: parsed.basis!,
    portion: "1.5",
    checked: true,
    source: "ai",
  });
  assert.equal(meal.foods[0].nutrition.kcal, 300);
  assert.equal(meal.foods[0].source, "ai");
  assert.equal(
    parseLabelExtraction({ ...result, uncertainFields: ["energy"] }).fields
      .kcal,
    "",
  );
  assert.equal(
    parseLabelExtraction({ ...result, energyUnit: null }).fields.kcal,
    "",
  );
  assert.deepEqual(parseLabelExtraction({ ...result, basis: null }).fields, {
    kcal: "",
    protein: "",
    carbs: "",
    fat: "",
  });
});
test("untrusted result types, bounds and missing fields cannot become confident nutrition", () => {
  assert.throws(() => parseLabelExtraction({}));
  assert.throws(() => parseLabelExtraction(null));
  const parsed = parseLabelExtraction({
    ...result,
    basis: "100g",
    nutrients: { energy: "200", protein: Infinity, carbs: -1, fat: 105 },
  });
  assert.deepEqual(parsed.fields, {
    kcal: "",
    protein: "",
    carbs: "",
    fat: "",
  });
  assert.equal(
    parseLabelExtraction({ ...result, nutrients: { energy: 0, protein: null } })
      .fields.kcal,
    "0",
  );
});
test("photo transport sends one authenticated callable request and validates its result", async () => {
  let calls = 0;
  const read = createLabelReader(async (url, options) => {
    calls++;
    assert.equal(url, "https://test.invalid/analyzeLabelCallable");
    assert.equal(
      (options!.headers as Record<string, string>).Authorization,
      "Bearer test-id-token",
    );
    assert.deepEqual(JSON.parse(options!.body as string), { data: image });
    return new Response(JSON.stringify({ result }));
  }, connection);
  assert.equal((await read(image)).fields.kcal, "200");
  assert.equal(calls, 1);
});
test("configuration, quota, malformed and network errors are actionable with no automatic retry", async () => {
  for (const [status, code, match] of [
    [503, "FAILED_PRECONDITION", /server configuration/],
    [429, "RESOURCE_EXHAUSTED", /limit/],
    [403, "PERMISSION_DENIED", /verification/],
    [400, "DATA_LOSS", /clear/],
  ] as const) {
    let calls = 0;
    await assert.rejects(
      () =>
        createLabelReader(async () => {
          calls++;
          return new Response(
            JSON.stringify({
              error: { status: code, message: "sensitive provider detail" },
            }),
            { status },
          );
        }, connection)(image),
      match,
    );
    assert.equal(calls, 1);
  }
  await assert.rejects(
    () =>
      createLabelReader(
        async () => new Response("not json"),
        connection,
      )(image),
    /could not be read/,
  );
  await assert.rejects(
    () =>
      createLabelReader(async () => {
        throw new TypeError("offline");
      }, connection)(image),
    /connect/,
  );
});
test("cancellation and timeout also cover credentials, preventing a late photo upload", async () => {
  let sent = 0;
  let unlock: (value: Awaited<ReturnType<typeof connection>>) => void;
  const credentials = new Promise<Awaited<ReturnType<typeof connection>>>(
    (resolve) => {
      unlock = resolve;
    },
  );
  const fetcher: typeof fetch = async () => {
    sent++;
    return new Response(JSON.stringify({ result }));
  };
  const controller = new AbortController();
  const pending = createLabelReader(fetcher, () => credentials)(
    image,
    controller.signal,
  );
  controller.abort();
  await assert.rejects(() => pending, /cancelled/);
  unlock!(await connection());
  await Promise.resolve();
  assert.equal(sent, 0);
  await assert.rejects(
    () => createLabelReader(fetcher, () => new Promise(() => {}), 5)(image),
    /timed out/,
  );
  assert.equal(sent, 0);
});
