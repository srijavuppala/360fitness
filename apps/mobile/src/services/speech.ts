import { requireOptionalNativeModule } from "expo";
import type { SpeechEngine } from "./speech-session";

export function getSpeechEngine(): SpeechEngine | null {
  try {
    const module = requireOptionalNativeModule<SpeechEngine>(
      "ExpoSpeechRecognition",
    );
    return module?.isRecognitionAvailable() ? module : null;
  } catch {
    return null;
  }
}
