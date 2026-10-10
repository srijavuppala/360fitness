import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Linking, Platform, TextInput, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { Button, Copy, Field, Notice } from "./ui";
import { DetailSheet } from "./MobileFrame";
import { colors as c } from "../theme";
import { getSpeechEngine } from "../services/speech";
import {
  combineDictation,
  createSpeechSession,
  SpeechPhase,
} from "../services/speech-session";

export function VoiceTextField({
  label,
  value,
  onChange,
  disabled,
  maxLength = 300,
  compact = false,
}: {
  label: string;
  value: string;
  onChange(value: string): void;
  disabled: boolean;
  maxLength?: number;
  compact?: boolean;
}) {
  const input = useRef<TextInput>(null);
  const [engine] = useState(getSpeechEngine);
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<SpeechPhase>("idle");
  const [transcript, setTranscript] = useState("");
  const [message, setMessage] = useState("");
  const session = useRef<ReturnType<typeof createSpeechSession> | null>(null);
  const mounted = useRef(true);
  const recording = useRef(false);
  const busy = phase !== "idle";
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      session.current?.cancel();
    };
  }, []);
  useFocusEffect(useCallback(() => () => session.current?.cancel(), []));
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      // Permission dialogs can temporarily make iOS inactive. Only cancel when
      // actually backgrounded, or when leaving the screen via focus cleanup.
      if (state === "background") session.current?.cancel();
    });
    return () => subscription.remove();
  }, []);
  function start() {
    if (!engine || recording.current || disabled) return;
    recording.current = true;
    setTranscript("");
    setMessage("");
    session.current = createSpeechSession(engine, {
      phase: (next) => {
        recording.current = next !== "idle";
        if (mounted.current) setPhase(next);
      },
      transcript: (next) => {
        if (mounted.current) setTranscript(next);
      },
      error: (next) => {
        if (mounted.current) setMessage(next);
      },
    });
    void session.current.start();
  }
  function apply(append: boolean) {
    const next = combineDictation(value, transcript, append);
    if (busy || !transcript.trim() || next.length > maxLength || disabled)
      return;
    onChange(next);
    setOpen(false);
    setTranscript("");
    setMessage("");
  }
  return (
    <View style={{ gap: 12 }}>
      {compact ? (
        <TextInput
          ref={input}
          accessibilityLabel={label}
          value={value}
          onChangeText={onChange}
          editable={!disabled && !busy}
          maxLength={maxLength}
          autoCapitalize="sentences"
          multiline
          placeholder="In your own words…"
          placeholderTextColor={c.muted}
          style={{
            minHeight: 124,
            maxHeight: 180,
            textAlignVertical: "top",
            fontSize: 17,
            lineHeight: 25,
            padding: 16,
            borderRadius: 18,
            borderWidth: 1,
            borderColor: c.border,
            backgroundColor: "white",
            color: c.text,
          }}
        />
      ) : (
        <Field
          style={{
            minHeight: maxLength > 300 ? 120 : 80,
            textAlignVertical: "top",
          }}
          ref={input}
          label={label}
          accessibilityLabel={label}
          value={value}
          onChangeText={onChange}
          editable={!disabled && !busy}
          maxLength={maxLength}
          autoCapitalize="sentences"
          multiline
          placeholder="In your own words…"
        />
      )}
      <Copy muted style={{ fontSize: 11 }}>
        {value.length}/{maxLength} characters · Type or use your voice
      </Copy>
      {!engine ? (
        <>
          <Button
            secondary
            disabled={disabled}
            icon="mic-outline"
            onPress={() => {
              input.current?.focus();
              setMessage(
                Platform.OS === "web"
                  ? "On your phone, tap the keyboard microphone and speak. You can also type here."
                  : "Tap the microphone on your keyboard, speak, then review the words in this field. If the microphone is missing, enable keyboard dictation in your phone’s settings.",
              );
            }}
          >
            Dictate with keyboard
          </Button>
          {message ? (
            <Notice>{message}</Notice>
          ) : compact ? null : (
            <Copy muted style={{ fontSize: 12 }}>
              Tap the keyboard microphone to explain your answer. You can edit
              the words before continuing.
            </Copy>
          )}
        </>
      ) : !open ? (
        <Button
          secondary
          icon="mic-outline"
          disabled={disabled}
          onPress={() => {
            input.current?.blur();
            setOpen(true);
            setMessage("");
          }}
        >
          Speak your answer
        </Button>
      ) : (
        <DetailSheet
          visible={open}
          title="Speak your answer"
          onClose={() => {
            session.current?.cancel();
            setOpen(false);
            setTranscript("");
            setMessage("");
          }}
        >
          <Copy>Say it in your own words</Copy>
          <Copy muted style={{ fontSize: 12 }}>
            English (US) · Up to 60 seconds. Your phone’s speech service may
            process audio online. This app does not save recordings.
          </Copy>
          {busy ? (
            <>
              <Copy>
                {phase === "requesting"
                  ? "Waiting for microphone permission…"
                  : phase === "finishing"
                    ? "Finishing transcription…"
                    : "Listening… tell us about your meals or goals."}
              </Copy>
              {phase === "listening" ? (
                <Button
                  icon="stop-circle-outline"
                  onPress={() => session.current?.stop()}
                >
                  Stop & review
                </Button>
              ) : null}
            </>
          ) : (
            <Button icon="mic-outline" disabled={disabled} onPress={start}>
              {transcript ? "Record again" : "Start speaking"}
            </Button>
          )}
          {transcript ? (
            <>
              <Field
                label="Review recognized text"
                style={{ minHeight: 120, textAlignVertical: "top" }}
                multiline
                value={transcript}
                editable={!busy && !disabled}
                onChangeText={setTranscript}
                maxLength={6000}
              />
              <Copy muted style={{ fontSize: 12 }}>
                Check names, amounts and allergies before using this text.{" "}
                {transcript.trim().length}/{maxLength} characters.
              </Copy>
              {transcript.trim().length > maxLength ? (
                <Notice>
                  Shorten this text to {maxLength} characters before using it.
                </Notice>
              ) : null}
              <Button
                disabled={
                  busy ||
                  disabled ||
                  !transcript.trim() ||
                  transcript.trim().length > maxLength
                }
                onPress={() => apply(false)}
              >
                {value.trim() ? "Replace current answer" : "Use this text"}
              </Button>
              {value.trim() ? (
                <Button
                  secondary
                  disabled={
                    busy ||
                    disabled ||
                    !transcript.trim() ||
                    combineDictation(value, transcript, true).length > maxLength
                  }
                  onPress={() => apply(true)}
                >
                  Add to current answer
                </Button>
              ) : null}
            </>
          ) : null}
          {message ? <Notice>{message}</Notice> : null}
          {message.includes("Settings") ? (
            <Button
              secondary
              onPress={() =>
                void Linking.openSettings().catch(() =>
                  setMessage(
                    "Open your phone’s Settings to allow microphone and speech access.",
                  ),
                )
              }
            >
              Open Settings
            </Button>
          ) : null}
          <Button
            secondary
            onPress={() => {
              session.current?.cancel();
              setOpen(false);
              setTranscript("");
              setMessage("");
            }}
          >
            Cancel voice entry
          </Button>
        </DetailSheet>
      )}
    </View>
  );
}
