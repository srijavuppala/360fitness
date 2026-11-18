import { useRef, useState } from "react";
import {
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Redirect, router } from "expo-router";
import { Button, Copy, Icon, Notice } from "../components/ui";
import { MobileFrame } from "../components/MobileFrame";
import { useApp } from "../data/store";
import {
  answerOptions,
  Condition,
  conditionOptions,
  draftFromHealth,
  HealthAnswer,
  HealthDraft,
  healthFromDraft,
  KIDNEY,
  NOTE_MAX_LENGTH,
  OTHER_CONDITION,
  OTHER_MAX_LENGTH,
  toggleCondition,
} from "../domain/health";
import {
  CONSENT_NOTICE,
  DISCLAIMER,
  HEALTH_INTRO,
  KIDNEY_DISCLAIMER,
} from "../domain/health-copy";
import { colors as c } from "../theme";

export default function Health() {
  const { ready } = useApp();
  return ready ? <HealthSection /> : <Redirect href="/" />;
}

function HealthSection() {
  const { state, update, saving } = useApp();
  const existing = state.health;
  const [started, setStarted] = useState(!!existing);
  const [draft, setDraft] = useState<HealthDraft>(() =>
    draftFromHealth(existing),
  );
  const [error, setError] = useState("");
  const working = useRef(false);
  const onboarding = state.onboarding !== "complete";
  const leave = () =>
    router.replace(onboarding ? "/welcome" : "/(tabs)/profile");

  async function commit(change: Parameters<typeof update>[0]) {
    if (working.current) return;
    working.current = true;
    Keyboard.dismiss();
    setError("");
    try {
      await update(change);
      leave();
    } catch (cause) {
      // Never echo stored answers; only show known validation messages.
      setError(
        cause instanceof Error && /grams/.test(cause.message)
          ? cause.message
          : "Couldn’t save on this device. Your answers are still here. Try again.",
      );
    } finally {
      working.current = false;
    }
  }
  const set = (patch: Partial<HealthDraft>) => {
    setDraft((previous) => ({ ...previous, ...patch }));
    setError("");
  };

  const header = (
    <View style={s.topbar}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back"
        disabled={saving}
        style={s.iconButton}
        onPress={() => (router.canGoBack() ? router.back() : leave())}
      >
        <Icon name="arrow-back" />
      </Pressable>
      <Text style={s.navTitle}>Health & Medical Information</Text>
      <View style={s.iconButton} />
    </View>
  );

  if (!started)
    return (
      <MobileFrame
        header={header}
        footer={
          <>
            <Button icon="arrow-forward" onPress={() => setStarted(true)}>
              Continue
            </Button>
            <Button secondary disabled={saving} onPress={leave}>
              Skip for now
            </Button>
          </>
        }
      >
        <View style={s.heading}>
          <Text accessibilityRole="header" style={s.title}>
            Health & Medical Information
          </Text>
          <Copy muted>{HEALTH_INTRO}</Copy>
        </View>
        <Notice>{CONSENT_NOTICE}</Notice>
        <Copy muted style={s.fine}>
          {DISCLAIMER}
        </Copy>
      </MobileFrame>
    );

  const kidney = draft.conditions.includes(KIDNEY);
  return (
    <MobileFrame
      header={header}
      footer={
        <>
          {error ? (
            <Text accessibilityRole="alert" style={s.error}>
              {error}
            </Text>
          ) : null}
          <Button
            busy={saving}
            icon="checkmark"
            onPress={() =>
              void commit((previous) => ({
                ...previous,
                health: healthFromDraft(draft, previous.health),
              }))
            }
          >
            Save
          </Button>
          {existing ? (
            <Button
              secondary
              disabled={saving}
              onPress={() =>
                void commit(({ health: _removed, healthUnreadable: _unreadable, ...rest }) => rest)
              }
            >
              Remove my health information
            </Button>
          ) : (
            <Button secondary disabled={saving} onPress={leave}>
              Skip this section
            </Button>
          )}
          <Text style={s.footnote}>
            Optional · Saved on this device · You can change it later in Profile
          </Text>
        </>
      }
    >
      <View style={s.heading}>
        <Text style={s.kicker}>OPTIONAL · PICK ALL THAT FIT</Text>
        <Text accessibilityRole="header" style={s.title}>
          Do you currently have any health conditions that may affect your
          nutrition or dietary requirements?
        </Text>
      </View>
      <View style={s.choices}>
        {conditionOptions.map((option) => (
          <Choice
            key={option}
            label={option}
            multi
            selected={draft.conditions.includes(option)}
            disabled={saving}
            onPress={() =>
              set({
                conditions: toggleCondition(
                  draft.conditions,
                  option as Condition,
                ),
              })
            }
          />
        ))}
      </View>
      {draft.conditions.includes(OTHER_CONDITION) ? (
        <NoteField
          label="Optional: tell us briefly (not required)"
          value={draft.conditionOther}
          max={OTHER_MAX_LENGTH}
          disabled={saving}
          onChange={(conditionOther) => set({ conditionOther })}
        />
      ) : null}
      {kidney ? (
        <>
          <Notice>{KIDNEY_DISCLAIMER}</Notice>
          <NoteField
            label="Optional: daily protein target (g) given by your nephrologist or dietitian"
            value={draft.clinicianProtein}
            max={3}
            numeric
            disabled={saving}
            onChange={(clinicianProtein) => set({ clinicianProtein })}
          />
          <Copy muted style={s.fine}>
            360Fitness will show this as your care team’s value. It does not
            check or endorse it.
          </Copy>
        </>
      ) : null}

      <AnswerQuestion
        label="Do you follow any dietary restrictions because of a health condition or professional recommendation?"
        value={draft.dietaryRestrictions}
        note={draft.dietaryRestrictionsNote}
        noteLabel="Optional: tell us more"
        disabled={saving}
        onAnswer={(dietaryRestrictions) => set({ dietaryRestrictions })}
        onNote={(dietaryRestrictionsNote) => set({ dietaryRestrictionsNote })}
      />
      <AnswerQuestion
        label="Have you been advised by a healthcare professional to follow any specific dietary or nutritional restrictions?"
        value={draft.professionalGuidance}
        note={draft.professionalGuidanceNote}
        noteLabel="Optional: describe the restrictions"
        disabled={saving}
        onAnswer={(professionalGuidance) => set({ professionalGuidance })}
        onNote={(professionalGuidanceNote) => set({ professionalGuidanceNote })}
      />
      <Copy muted style={s.fine}>
        {DISCLAIMER}
      </Copy>
    </MobileFrame>
  );
}

function AnswerQuestion({
  label,
  value,
  note,
  noteLabel,
  disabled,
  onAnswer,
  onNote,
}: {
  label: string;
  value?: HealthAnswer;
  note: string;
  noteLabel: string;
  disabled: boolean;
  onAnswer(value: HealthAnswer | undefined): void;
  onNote(value: string): void;
}) {
  return (
    <View style={{ gap: 12 }}>
      <Text accessibilityRole="header" style={s.question}>
        {label}
      </Text>
      <View style={s.choices}>
        {answerOptions.map((option) => (
          <Choice
            key={option}
            label={option}
            selected={value === option}
            disabled={disabled}
            onPress={() => onAnswer(value === option ? undefined : option)}
          />
        ))}
      </View>
      {value === "Yes" ? (
        <NoteField
          label={noteLabel}
          value={note}
          max={NOTE_MAX_LENGTH}
          disabled={disabled}
          onChange={onNote}
        />
      ) : null}
    </View>
  );
}

function Choice({
  label,
  selected,
  multi,
  disabled,
  onPress,
}: {
  label: string;
  selected: boolean;
  multi?: boolean;
  disabled: boolean;
  onPress(): void;
}) {
  return (
    <Pressable
      accessibilityRole={multi ? "checkbox" : "radio"}
      accessibilityLabel={label}
      accessibilityState={{ checked: selected, disabled }}
      aria-checked={selected}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        s.choice,
        selected && s.selected,
        pressed && { opacity: 0.7 },
      ]}
    >
      <Text style={[s.option, selected && { color: c.accent }]}>{label}</Text>
      <Icon
        size={20}
        color={selected ? c.accent : c.border}
        name={selected ? "checkmark-circle" : "ellipse-outline"}
      />
    </Pressable>
  );
}

function NoteField({
  label,
  value,
  max,
  numeric,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  max: number;
  numeric?: boolean;
  disabled: boolean;
  onChange(value: string): void;
}) {
  return (
    <View style={{ gap: 6 }}>
      <Copy muted style={s.fine}>
        {label}
      </Copy>
      <TextInput
        accessibilityLabel={label}
        style={s.input}
        value={value}
        onChangeText={onChange}
        editable={!disabled}
        maxLength={max}
        keyboardType={numeric ? "number-pad" : "default"}
        autoCorrect={false}
        // Sensitive text: keep it out of keyboard learning and autofill.
        autoComplete="off"
        placeholderTextColor={c.muted}
      />
    </View>
  );
}

const s = StyleSheet.create({
  topbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  iconButton: {
    minWidth: 48,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  navTitle: {
    color: c.text,
    fontSize: 15,
    fontWeight: "600",
    flex: 1,
    textAlign: "center",
  },
  heading: { gap: 8 },
  kicker: {
    fontSize: 10,
    letterSpacing: 1.3,
    fontWeight: "700",
    color: c.accent,
  },
  title: {
    fontSize: 24,
    lineHeight: 30,
    letterSpacing: -0.6,
    fontWeight: "700",
    color: c.text,
  },
  question: { fontSize: 18, lineHeight: 24, fontWeight: "600", color: c.text },
  choices: { gap: 8 },
  choice: {
    minHeight: 54,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: "white",
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  selected: { backgroundColor: c.accentSoft, borderColor: c.accent },
  option: { flex: 1, color: c.text, fontSize: 14, lineHeight: 20, fontWeight: "500" },
  input: {
    minHeight: 54,
    fontSize: 16,
    color: c.text,
    backgroundColor: "white",
    borderRadius: 15,
    borderWidth: 1,
    borderColor: c.border,
    paddingHorizontal: 14,
  },
  fine: { fontSize: 12, lineHeight: 18 },
  footnote: { fontSize: 11, color: c.muted, textAlign: "center", paddingTop: 3 },
  error: { color: c.danger, fontSize: 13, lineHeight: 18 },
});
