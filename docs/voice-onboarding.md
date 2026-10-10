# Voice entry for onboarding

Implemented 2026-10-08. Applies to free-text onboarding answers, including goals, diet description, other diet/allergy details and foods avoided.

## Experience

- **Expo Go / browser preview / unavailable recognizer:** “Dictate with keyboard” focuses the answer field and explains how to use the phone keyboard microphone. The keyboard handles its own dictation and permissions. Typed editing is always available.
- **Installed iOS/Android build with recognition support:** “Speak your answer” opens an explanation; “Start speaking” requests microphone and speech-recognition permission. The default language is English (US), one utterance at a time, with a 60-second capture limit. Stop can finish sooner.
- Recognized words remain a draft until the user chooses **Use this text**, **Replace current answer**, or **Add to current answer**. Interim recognition replaces previous interim text instead of duplicating it. No transcription is automatically submitted.
- Cancellation, navigation and backgrounding stop capture. Late permission responses cannot start a cancelled session. One field at a time owns the recognizer. Denial, interruption, unavailable services and network failures retain normal text entry.
- The optional **Describe your usual diet** field supports 1,000 characters. Other free-text answers remain at 300. Long voice drafts must be shortened before applying; existing answers are not silently truncated or overwritten.

## Data handling

The app does not persist audio files or send audio to its AI/Firebase backend. The operating system's speech provider may process audio online; this is disclosed before starting. Accepted text follows the existing local draft/profile storage flow and is uploaded only through an explicit cloud profile save. No meal is generated or logged from this explanation. Users must review food names, amounts and allergies.

## Build requirements

Dependency: `expo-speech-recognition ~57.1.0`, matching Expo SDK 57. The config plugin supplies Android microphone permission and iOS microphone/speech usage descriptions. Camera/image-picker microphone descriptions must not be `false`, because those plugins otherwise remove the iOS microphone description required for dictation.

Existing Expo Go installations cannot acquire this native module from a JavaScript refresh. Build a new development client using the existing EAS development profile, then open Metro with `expo start --dev-client`. Old development builds without the module safely use keyboard dictation until rebuilt. Expo Go remains supported with the keyboard option.

References: [speech-recognition installation and native APIs](https://github.com/jamsch/expo-speech-recognition), [Expo development builds](https://docs.expo.dev/develop/development-builds/introduction/).

## Verification and outstanding device checks

- Mobile typecheck/lint and 67 tests pass, including recognition lifecycle, late permissions, exclusive microphone ownership, timeout, stop/cancel, transcript handling and diet-text bounds.
- 79 Firestore rule tests pass, including the 1,000-character optional diet field.
- iOS, Android and web JS bundle exports pass.
- Introspected config includes iOS `NSMicrophoneUsageDescription` and `NSSpeechRecognitionUsageDescription`, and Android `RECORD_AUDIO`.
- Browser UI verifies focus on “Dictate with keyboard”, typed diet draft persistence across reload and the 1,000-character counter. The fixture explanation is typed test text, not evidence of actual recognition.
- Still required: rebuilt iPhone/Android device tests for real transcription, permission denial/revocation, backgrounding, Bluetooth/phone-call interruption and offline provider behavior. No signed build or live voice transcription was produced in this pass.
