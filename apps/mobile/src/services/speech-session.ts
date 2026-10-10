export type SpeechEvents = {
  start: unknown;
  end: unknown;
  result: { results: { transcript: string }[]; isFinal: boolean };
  error: { error: string };
};
export type SpeechEngine = {
  isRecognitionAvailable(): boolean;
  requestPermissionsAsync(): Promise<{
    granted: boolean;
    canAskAgain: boolean;
  }>;
  addListener<K extends keyof SpeechEvents>(
    name: K,
    listener: (event: SpeechEvents[K]) => void,
  ): { remove(): void };
  start(options: {
    lang: string;
    interimResults: boolean;
    continuous: boolean;
    maxAlternatives: number;
    recordingOptions: { persist: boolean };
  }): void;
  stop(): void;
  abort(): void;
};
export type SpeechPhase = "idle" | "requesting" | "listening" | "finishing";
export function speechError(code: string) {
  if (code === "not-allowed")
    return "Microphone or speech permission was denied. You can enable it in Settings or keep typing.";
  if (code === "no-speech" || code === "speech-timeout")
    return "No speech was detected. Try again or type your answer.";
  if (code === "network")
    return "Speech recognition couldn’t connect. Check your connection or use the keyboard.";
  if (code === "language-not-supported")
    return "English speech recognition isn’t available on this device. Use keyboard dictation or type instead.";
  if (code === "busy")
    return "Another voice field is listening. Finish or cancel it first.";
  if (code === "interrupted")
    return "Dictation was interrupted. Review the words captured or try again.";
  return "Couldn’t transcribe your voice. Try again or use the keyboard.";
}
// The OS recognizer is shared. Only the active field owns its microphone/listeners.
let owner: symbol | null = null;
export function createSpeechSession(
  engine: SpeechEngine,
  callbacks: {
    phase(value: SpeechPhase): void;
    transcript(value: string): void;
    error(message: string): void;
  },
) {
  const token = Symbol("dictation");
  let closed = false;
  let requested = false;
  let stopping = false;
  let text = "";
  const subscriptions: { remove(): void }[] = [];
  let duration: ReturnType<typeof setTimeout> | undefined;
  let finishing: ReturnType<typeof setTimeout> | undefined;
  function cleanup(abort: boolean) {
    if (closed) return;
    closed = true;
    clearTimeout(duration);
    clearTimeout(finishing);
    subscriptions.forEach((subscription) => subscription.remove());
    if (owner === token) {
      if (abort) {
        try {
          engine.abort();
        } catch {
          /* Already stopped by the OS. */
        }
      }
      owner = null;
    }
    callbacks.phase("idle");
  }
  function fail(code: string) {
    callbacks.error(speechError(code));
    cleanup(true);
  }
  function stop() {
    if (closed || stopping || owner !== token) return;
    stopping = true;
    callbacks.phase("finishing");
    clearTimeout(duration);
    try {
      engine.stop();
    } catch {
      fail("unknown");
      return;
    }
    // A service must not leave the UI waiting indefinitely for a final event.
    if (!closed)
      finishing = setTimeout(() => {
        callbacks.error(
          "Dictation stopped. Review the words captured before adding them.",
        );
        cleanup(true);
      }, 5000);
  }
  return {
    async start() {
      if (requested || closed) return;
      requested = true;
      if (owner) {
        callbacks.error(speechError("busy"));
        cleanup(false);
        return;
      }
      owner = token;
      callbacks.phase("requesting");
      try {
        const permission = await engine.requestPermissionsAsync();
        // A permission prompt may finish after the field was closed or navigated away.
        if (closed) return;
        if (!permission.granted) {
          fail("not-allowed");
          return;
        }
        subscriptions.push(
          engine.addListener("start", () => {
            if (!closed) callbacks.phase("listening");
          }),
        );
        subscriptions.push(
          engine.addListener("result", (event) => {
            if (closed) return;
            text = (event.results[0]?.transcript ?? "").slice(0, 6000);
            callbacks.transcript(text);
          }),
        );
        subscriptions.push(
          engine.addListener("error", (event) => {
            if (!closed) fail(event.error);
          }),
        );
        subscriptions.push(
          engine.addListener("end", () => {
            if (closed) return;
            if (!text.trim()) callbacks.error(speechError("no-speech"));
            cleanup(false);
          }),
        );
        duration = setTimeout(stop, 60000);
        engine.start({
          lang: "en-US",
          interimResults: true,
          continuous: false,
          maxAlternatives: 1,
          recordingOptions: { persist: false },
        });
      } catch {
        if (!closed) fail("unknown");
      }
    },
    stop,
    cancel() {
      cleanup(true);
    },
  };
}
export function combineDictation(
  current: string,
  transcript: string,
  append: boolean,
) {
  const spoken = transcript.trim();
  return append && current.trim() ? `${current.trim()}\n${spoken}` : spoken;
}
