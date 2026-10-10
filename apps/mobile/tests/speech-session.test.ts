import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  combineDictation,
  createSpeechSession,
  SpeechEngine,
  SpeechEvents,
  SpeechPhase,
} from "../src/services/speech-session";
class FakeEngine implements SpeechEngine {
  listeners = new Map<string, Set<(event: unknown) => void>>();
  permission = Promise.resolve({ granted: true, canAskAgain: true });
  starts: Parameters<SpeechEngine["start"]>[0][] = [];
  failListener?: keyof SpeechEvents;
  aborts = 0;
  stops = 0;
  isRecognitionAvailable() {
    return true;
  }
  requestPermissionsAsync() {
    return this.permission;
  }
  addListener<K extends keyof SpeechEvents>(
    name: K,
    listener: (event: SpeechEvents[K]) => void,
  ) {
    if (name === this.failListener) throw new Error("Native listener failed");
    const wrapped = (event: unknown) => listener(event as SpeechEvents[K]);
    const list = this.listeners.get(name) ?? new Set();
    list.add(wrapped);
    this.listeners.set(name, list);
    return {
      remove: () => {
        list.delete(wrapped);
      },
    };
  }
  emit<K extends keyof SpeechEvents>(name: K, event: SpeechEvents[K]) {
    this.listeners.get(name)?.forEach((fn) => fn(event));
  }
  start(options: Parameters<SpeechEngine["start"]>[0]) {
    this.starts.push(options);
    this.emit("start", undefined);
  }
  stop() {
    this.stops++;
  }
  abort() {
    this.aborts++;
  }
}
function fixture(engine = new FakeEngine()) {
  const phases: SpeechPhase[] = [],
    transcripts: string[] = [],
    errors: string[] = [];
  const session = createSpeechSession(engine, {
    phase: (v) => phases.push(v),
    transcript: (v) => transcripts.push(v),
    error: (v) => errors.push(v),
  });
  return { engine, session, phases, transcripts, errors };
}
test("dictation replaces interim hypotheses and waits for explicit acceptance outside the session", async () => {
  const f = fixture();
  await f.session.start();
  f.engine.emit("result", {
    results: [{ transcript: "I eat" }],
    isFinal: false,
  });
  f.engine.emit("result", {
    results: [{ transcript: "I eat rice and vegetables" }],
    isFinal: true,
  });
  f.engine.emit("end", undefined);
  assert.deepEqual(f.transcripts, ["I eat", "I eat rice and vegetables"]);
  assert.deepEqual(f.phases, ["requesting", "listening", "idle"]);
  assert.equal(f.engine.starts[0].continuous, false);
  assert.equal(f.engine.starts[0].recordingOptions.persist, false);
  assert.equal(
    [...f.engine.listeners.values()].every((list) => list.size === 0),
    true,
  );
});
test("closing during permission request prevents later microphone activation", async () => {
  const f = fixture();
  let grant!: (value: { granted: boolean; canAskAgain: boolean }) => void;
  f.engine.permission = new Promise((resolve) => {
    grant = resolve;
  });
  const pending = f.session.start();
  f.session.cancel();
  grant({ granted: true, canAskAgain: true });
  await pending;
  assert.equal(f.engine.starts.length, 0);
  f.engine.emit("result", {
    results: [{ transcript: "late event" }],
    isFinal: true,
  });
  assert.deepEqual(f.transcripts, []);
});
test("denied permission never starts recognition and provides a typing fallback", async () => {
  const f = fixture();
  f.engine.permission = Promise.resolve({ granted: false, canAskAgain: false });
  await f.session.start();
  assert.equal(f.engine.starts.length, 0);
  assert.match(f.errors[0], /Settings or keep typing/);
});
test("only one field owns recognition and cancelling another cannot abort it", async () => {
  const first = fixture(),
    second = fixture();
  await first.session.start();
  await second.session.start();
  second.session.cancel();
  assert.equal(second.engine.starts.length, 0);
  assert.equal(second.engine.aborts, 0);
  assert.match(second.errors[0], /Another voice field/);
  first.session.cancel();
});
test("stop retains the final result while cancellation ignores late results", async () => {
  const f = fixture();
  await f.session.start();
  f.session.stop();
  assert.equal(f.engine.stops, 1);
  f.engine.emit("result", {
    results: [{ transcript: "Final words" }],
    isFinal: true,
  });
  f.engine.emit("end", undefined);
  assert.deepEqual(f.transcripts, ["Final words"]);
  f.engine.emit("result", {
    results: [{ transcript: "Stale words" }],
    isFinal: true,
  });
  assert.deepEqual(f.transcripts, ["Final words"]);
});
test("a session has a time limit and a bounded wait for final transcription", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const f = fixture();
  await f.session.start();
  t.mock.timers.tick(60000);
  assert.equal(f.engine.stops, 1);
  t.mock.timers.tick(5000);
  assert.equal(f.engine.aborts, 1);
  assert.equal(f.phases.at(-1), "idle");
});
test("provider errors are understandable and never expose raw responses", async () => {
  const f = fixture();
  await f.session.start();
  f.engine.emit("error", { error: "private diagnostic" });
  assert.doesNotMatch(f.errors[0], /private/);
  assert.equal(f.phases.at(-1), "idle");
});
test("append preserves the current answer and replacement is explicit", () => {
  assert.equal(
    combineDictation("Existing meal plan", "  Add vegetables. ", true),
    "Existing meal plan\nAdd vegetables.",
  );
  assert.equal(
    combineDictation("Existing meal plan", "  New plan. ", false),
    "New plan.",
  );
});

test("partial native setup failure releases listeners and microphone ownership", async () => {
  const f = fixture();
  f.engine.failListener = "result";
  await f.session.start();
  assert.equal(f.engine.starts.length, 0);
  assert.equal(
    [...f.engine.listeners.values()].every((list) => list.size === 0),
    true,
  );
  const next = fixture();
  await next.session.start();
  assert.equal(next.engine.starts.length, 1);
  next.session.cancel();
});
