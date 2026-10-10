import type { SpeechEngine } from "./speech-session";
// Browser previews keep text entry and system keyboard dictation. Native speech
// recognition is configured in the installable iPhone/Android application.
export function getSpeechEngine(): SpeechEngine | null {
  return null;
}
