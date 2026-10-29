import { useRef, useState } from "react";
import {
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Redirect, router } from "expo-router";
import { Button, Copy, Icon, Notice } from "../components/ui";
import {
  DetailSheet,
  MobileFrame,
  SettingsRow,
} from "../components/MobileFrame";
import { useApp } from "../data/store";
import {
  answerLabel,
  AnswerKey,
  changeAnswer,
  choicesFor,
  goalLabels,
  formatCheckInTime,
  ProfileAnswers,
  profileSteps,
  Question,
  saveProfile,
  stepErrors,
  toggleSelection,
  visibleQuestion,
} from "../domain/profile";
import {
  draftAt,
  firstProfileIssue,
  ProfileCursor,
  profilePages,
  profileSections,
  resumeProfile,
} from "../domain/profile-flow";
import { VoiceTextField } from "../components/VoiceTextField";
import { TargetSummary } from "../components/TargetSummary";
import { calculateTargets } from "../domain/targets";
import { colors as c } from "../theme";

export default function Preferences() {
  const { ready } = useApp();
  return ready ? <Questionnaire /> : <Redirect href="/" />;
}
function Questionnaire() {
  const { state, update, saving } = useApp();
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const compact = height - insets.top - insets.bottom < 700;
  const [answers, setAnswers] = useState<ProfileAnswers>(() => {
    return {
      ...(state.profileDraft?.answers ??
        state.profile?.answers ?? { primaryGoal: goalLabels[state.goal] }),
    };
  });
  const [cursor, setCursor] = useState<ProfileCursor>(() =>
    resumeProfile(state.profileDraft, !!state.profile),
  );
  const [editing, setEditing] = useState(false);
  const [sheet, setSheet] = useState<number | "help" | null>(null);
  const [error, setError] = useState("");
  const working = useRef(false);
  const pages = profilePages(answers);
  const index = pages.findIndex((p) => p.question.key === cursor);
  const page = pages[index];
  const review = cursor === "review";
  const question = page?.question;
  const empty =
    question && (!answers[question.key] || answers[question.key]?.length === 0);
  async function persist(next: ProfileCursor, exit = false, finish = false) {
    if (working.current) return;
    working.current = true;
    Keyboard.dismiss();
    setError("");
    try {
      await update((previous) =>
        finish
          ? saveProfile(previous, answers)
          : {
              ...previous,
              profileDraft: draftAt(answers, next),
              onboarding:
                exit && previous.onboarding !== "complete"
                  ? "welcome"
                  : previous.onboarding,
            },
      );
      if (exit || finish)
        router.replace(
          state.onboarding === "complete" ? "/(tabs)/profile" : "/welcome",
        );
      else setCursor(next);
    } catch {
      setError(
        "Couldn’t save on this device. Your answers are still here. Try again.",
      );
    } finally {
      working.current = false;
    }
  }
  function next() {
    if (review) {
      const issue = firstProfileIssue(answers);
      if (issue) {
        setCursor(issue.cursor);
        setEditing(true);
        setError(issue.error);
        return;
      }
      void persist("review", false, true);
      return;
    }
    const issue = stepErrors(answers, page.step)[page.question.key];
    if (issue) {
      setError(issue);
      return;
    }
    // Editing an answer can reveal a required follow-up (for example Other allergies).
    const followUp = editing ? firstProfileIssue(answers, page.step) : null;
    void persist(
      editing
        ? (followUp?.cursor ?? "review")
        : (pages[index + 1]?.question.key ?? "review"),
    );
  }
  function change(key: AnswerKey, value: string | string[]) {
    setAnswers((previous) => changeAnswer(previous, key, value));
    setError("");
  }
  const title = question?.unit
    ? `${question.label} (${question.unit})`
    : question?.label;
  const targets = review ? calculateTargets(answers) : null;
  return (
    <MobileFrame
      key={cursor}
      header={
        <>
          <View style={s.topbar}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Previous question"
              disabled={saving}
              style={s.iconButton}
              onPress={() =>
                void persist(
                  editing
                    ? "review"
                    : review
                      ? pages[pages.length - 1].question.key
                      : pages[Math.max(index - 1, 0)].question.key,
                  !review && !editing && index === 0,
                )
              }
            >
              <Icon name="arrow-back" />
            </Pressable>
            <Text style={s.navTitle}>
              {review ? "Your profile" : profileSections[page.step]}
            </Text>
            {compact && question?.hint ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="About this question"
                onPress={() => setSheet("help")}
                style={s.iconButton}
              >
                <Icon name="information-circle-outline" color={c.muted} />
              </Pressable>
            ) : null}
            <Pressable
              accessibilityRole="button"
              disabled={saving}
              style={s.textButton}
              onPress={() => void persist(cursor, true)}
            >
              <Text style={s.link}>Save & exit</Text>
            </Pressable>
          </View>
          <View
            accessibilityRole="progressbar"
            accessibilityLabel="Profile setup progress"
            accessibilityValue={{
              min: 0,
              max: pages.length,
              now: review ? pages.length : index,
            }}
            style={s.track}
          >
            <View
              style={[
                s.fill,
                {
                  width: `${review ? 100 : ((index + 1) / (pages.length + 1)) * 100}%`,
                },
              ]}
            />
          </View>
        </>
      }
      footer={
        <>
          {error ? (
            <Text accessibilityRole="alert" style={s.error}>
              {error}
            </Text>
          ) : null}
          <Button
            busy={saving}
            onPress={next}
            icon={review || editing ? "checkmark" : "arrow-forward"}
          >
            {review
              ? "Save my profile"
              : editing
                ? "Done"
                : !question?.required && empty
                  ? "Skip for now"
                  : "Continue"}
          </Button>
          <Text style={s.footnote}>
            {review
              ? "Saved on this device · Cloud backup is optional"
              : "You can change this later in Profile"}
          </Text>
        </>
      }
    >
      {review ? (
        <>
          <View style={s.heading}>
            <Text accessibilityRole="header" style={s.title}>
              Make it yours.
            </Text>
            <Copy muted style={s.subtitle}>
              Tap a section to review or change your answers.
            </Copy>
          </View>
          {targets ? <TargetSummary targets={targets} /> : null}
          <View style={[s.grid, { gap: 8 }]}>
            {profileSteps.map((group, step) => (
              <Pressable
                key={group.title}
                accessibilityRole="button"
                accessibilityLabel={`Review ${profileSections[step]}`}
                onPress={() => setSheet(step)}
                style={s.reviewTile}
              >
                <View style={s.topbar}>
                  <Text style={s.reviewTitle}>{profileSections[step]}</Text>
                  <Icon name="chevron-forward" size={16} color={c.accent} />
                </View>
                <Text numberOfLines={1} style={s.reviewDetail}>
                  {answerLabel(answers, group.questions[0].key)}
                </Text>
              </Pressable>
            ))}
          </View>
        </>
      ) : (
        <View key={cursor} style={{ gap: compact ? 12 : 20 }}>
          <View style={s.heading}>
            {!compact ? (
              <View style={s.topbar}>
                <Text style={s.kicker}>
                  {question!.required ? "MAKE IT YOURS" : "OPTIONAL"}
                  {question!.kind === "multi" ? " · PICK ALL THAT FIT" : ""}
                </Text>
                {question!.hint ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="About this question"
                    onPress={() => setSheet("help")}
                    style={s.iconButton}
                  >
                    <Icon
                      name="information-circle-outline"
                      color={c.muted}
                      size={22}
                    />
                  </Pressable>
                ) : null}
              </View>
            ) : null}
            <Text accessibilityRole="header" style={s.title}>
              {title}
            </Text>
            <Text style={s.subtitle}>
              {!question!.required && compact
                ? "Optional · You can skip this for now."
                : question!.kind === "multi"
                  ? "Choose all that apply to you."
                  : question!.kind === "single"
                    ? "Choose the option that fits you best."
                    : question!.key === "targetWeightKg"
                      ? "We use it to estimate your daily calories and nutrients."
                      : question!.key === "outcome"
                        ? "For example, cook at home three evenings a week."
                        : "A little context helps make your profile yours."}
            </Text>
          </View>
          <QuestionField
            question={question!}
            answers={answers}
            disabled={saving}
            onChange={change}
          />
          {!question!.required && !empty ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Clear this answer"
              disabled={saving}
              onPress={() =>
                change(question!.key, question!.kind === "multi" ? [] : "")
              }
              style={s.textButton}
            >
              <Text style={s.link}>Clear answer</Text>
            </Pressable>
          ) : null}
        </View>
      )}
      <DetailSheet
        title={
          sheet === "help"
            ? "About this question"
            : typeof sheet === "number"
              ? profileSections[sheet]
              : "Details"
        }
        visible={sheet !== null}
        onClose={() => setSheet(null)}
      >
        {sheet === "help" ? (
          <Copy>{question?.hint}</Copy>
        ) : typeof sheet === "number" ? (
          <>
            {profileSteps[sheet].questions
              .filter((q) => visibleQuestion(q, answers))
              .map((q) => (
                <SettingsRow
                  key={q.key}
                  title={q.label}
                  detail={answerLabel(answers, q.key)}
                  disabled={saving}
                  onPress={() => {
                    setEditing(true);
                    setSheet(null);
                    void persist(q.key);
                  }}
                />
              ))}
            {sheet >= 4 ? (
              <Notice>
                Recommendations, scheduled reminders and wearable connections
                are not active yet. These answers save your preferences.
              </Notice>
            ) : null}
          </>
        ) : null}
      </DetailSheet>
    </MobileFrame>
  );
}
function QuestionField({
  question: q,
  answers,
  onChange,
  disabled,
}: {
  question: Question;
  answers: ProfileAnswers;
  onChange(key: AnswerKey, value: string | string[]): void;
  disabled: boolean;
}) {
  const value = answers[q.key];
  const choices = choicesFor(q.key);
  const grid = choices.length > 5;
  return choices.length ? (
    <View style={[s.choices, grid && s.grid]}>
      {choices.map((choice) => {
        const selected = Array.isArray(value)
          ? value.includes(choice)
          : value === choice;
        return (
          <Pressable
            key={choice}
            accessibilityRole={q.kind === "multi" ? "checkbox" : "radio"}
            accessibilityLabel={`${q.label}: ${choice}`}
            accessibilityState={{ checked: selected, disabled }}
            aria-checked={selected}
            disabled={disabled}
            onPress={() =>
              onChange(
                q.key,
                q.kind === "multi"
                  ? toggleSelection(Array.isArray(value) ? value : [], choice)
                  : choice,
              )
            }
            style={({ pressed }) => [
              s.choice,
              grid && s.gridChoice,
              selected && s.selected,
              pressed && { opacity: 0.7 },
            ]}
          >
            <Text style={[s.option, selected && { color: c.accent }]}>
              {choice}
            </Text>
            <Icon
              size={20}
              color={selected ? c.accent : c.border}
              name={selected ? "checkmark-circle" : "ellipse-outline"}
            />
          </Pressable>
        );
      })}
    </View>
  ) : q.kind === "text" ? (
    <VoiceTextField
      compact
      label={q.label}
      value={typeof value === "string" ? value : ""}
      onChange={(text) => onChange(q.key, text)}
      disabled={disabled}
      maxLength={q.maxLength ?? 300}
    />
  ) : (
    <TextInput
      accessibilityLabel={q.label}
      style={s.input}
      value={typeof value === "string" ? value : ""}
      onChangeText={(text) => onChange(q.key, text)}
      editable={!disabled}
      maxLength={q.kind === "time" ? 8 : 12}
      keyboardType={q.kind === "number" ? "decimal-pad" : "default"}
      autoCapitalize={q.kind === "time" ? "characters" : "none"}
      autoCorrect={false}
      onBlur={
        q.kind === "time" && typeof value === "string"
          ? () => onChange(q.key, formatCheckInTime(value))
          : undefined
      }
      placeholder={
        q.kind === "time"
          ? "7:30 PM"
          : q.unit
            ? `${q.min}–${q.max} ${q.unit}`
            : "Enter an amount"
      }
      placeholderTextColor={c.muted}
    />
  );
}
const s = StyleSheet.create({
  reviewTile: {
    width: "48.5%",
    minHeight: 78,
    padding: 12,
    borderRadius: 16,
    backgroundColor: "white",
    gap: 8,
    justifyContent: "center",
  },
  reviewTitle: { fontSize: 14, color: c.text, fontWeight: "600", flex: 1 },
  reviewDetail: { fontSize: 12, color: c.muted },
  topbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  navTitle: {
    color: c.text,
    fontSize: 15,
    fontWeight: "600",
    flex: 1,
    textAlign: "center",
  },
  iconButton: {
    minWidth: 48,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  textButton: { minHeight: 48, justifyContent: "center" },
  link: { color: c.accent, fontSize: 13, fontWeight: "600" },
  track: {
    height: 4,
    borderRadius: 4,
    backgroundColor: c.border,
    marginTop: 6,
  },
  fill: { height: 4, borderRadius: 4, backgroundColor: c.accent },
  heading: { gap: 6 },
  title: {
    fontSize: 28,
    lineHeight: 33,
    letterSpacing: -0.8,
    fontWeight: "700",
    color: c.text,
  },
  subtitle: { fontSize: 14, lineHeight: 21, color: c.muted },
  kicker: {
    fontSize: 10,
    letterSpacing: 1.3,
    fontWeight: "700",
    color: c.accent,
    minHeight: 34,
    textAlignVertical: "center",
  },
  choices: { gap: 8 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 5 },
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
  gridChoice: { width: "48.5%", minHeight: 48, paddingVertical: 10 },
  selected: { backgroundColor: c.accentSoft, borderColor: c.accent },
  option: {
    flex: 1,
    color: c.text,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "500",
  },
  input: {
    minHeight: 76,
    fontSize: 28,
    color: c.text,
    backgroundColor: "white",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: c.border,
    padding: 20,
  },
  footnote: {
    fontSize: 11,
    color: c.muted,
    textAlign: "center",
    paddingTop: 3,
  },
  error: { color: c.danger, fontSize: 13, lineHeight: 18 },
});
