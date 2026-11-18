import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import {
  Button,
  Card,
  Copy,
  DemoBanner,
  Field,
  Header,
  Icon,
  Notice,
  Screen,
  Section,
  styles,
} from "../../components/ui";
import { useApp } from "../../data/store";
import {
  describeProgress,
  describeSession,
  dispatch,
  emptyWorkoutState,
  formatReply,
  intensities,
  localDate,
  parseMessage,
  recentSessions,
  weekSummary,
  workoutTypes,
  type Command,
  type CommandResult,
  type Intensity,
  type WorkoutType,
} from "../../domain/workouts";
import { colors as c } from "../../theme";

const goalPresets: { label: string; command: Command }[] = [
  { label: "3 workouts / week", command: { action: "set_goal", metric: "sessions", target: 3 } },
  { label: "150 min / week", command: { action: "set_goal", metric: "minutes", target: 150 } },
  { label: "4 active days", command: { action: "set_goal", metric: "activeDays", target: 4 } },
];

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={{
        paddingVertical: 8,
        paddingHorizontal: 14,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: selected ? c.accent : c.border,
        backgroundColor: selected ? c.accentSoft : c.surface,
      }}
    >
      <Text style={{ color: selected ? c.accent : c.text, fontWeight: "600", fontSize: 13 }}>{label}</Text>
    </Pressable>
  );
}

function ProgressBar({ ratio }: { ratio: number }) {
  return (
    <View style={{ height: 8, borderRadius: 4, backgroundColor: c.elevated, overflow: "hidden" }}>
      <View style={{ width: `${Math.round(ratio * 100)}%`, height: 8, backgroundColor: c.accent }} />
    </View>
  );
}

export default function Train() {
  const { state, update, saving } = useApp();
  const workouts = state.workouts ?? emptyWorkoutState();
  const today = localDate();
  const week = weekSummary(workouts, today);
  const recent = recentSessions(workouts, 8);

  const [quick, setQuick] = useState("");
  const [preview, setPreview] = useState<Command | null>(null);
  const [type, setType] = useState<WorkoutType>("walk");
  const [duration, setDuration] = useState("");
  const [distance, setDistance] = useState("");
  const [intensity, setIntensity] = useState<Intensity>("moderate");
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  async function run(command: Command) {
    let result: CommandResult | null = null;
    try {
      await update((previous) => {
        const out = dispatch(previous.workouts ?? emptyWorkoutState(), command, { source: "app" });
        result = out.result;
        if (!out.result.ok) return previous;
        return { ...previous, workouts: out.state };
      });
      const r = result as CommandResult | null;
      if (r) setMessage({ text: formatReply(r), error: !r.ok });
      return r?.ok ?? false;
    } catch {
      setMessage({ text: "That couldn’t be saved on this device. Nothing was changed — try again.", error: true });
      return false;
    }
  }

  function reviewQuick() {
    const command = parseMessage(quick, today);
    if (!command || command.action === "help") {
      setPreview(null);
      setMessage({ text: 'Try “ran 5k in 28 min”, “45 min yoga easy” or “goal 3 workouts a week”.', error: true });
      return;
    }
    if (command.action === "clarify") {
      setPreview(null);
      setMessage({ text: command.question, error: true });
      return;
    }
    setMessage(null);
    setPreview(command);
  }

  async function logManual() {
    const minutes = Number(duration);
    const km = distance.trim() ? Number(distance) : undefined;
    const ok = await run({
      action: "log_workout",
      type,
      durationMin: minutes,
      intensity,
      ...(km !== undefined ? { distanceKm: km } : {}),
    });
    if (ok) {
      setDuration("");
      setDistance("");
    }
  }

  return (
    <Screen>
      <DemoBanner />
      <Header eyebrow="Move your way" title="Train" subtitle="Set a weekly goal, log what you did, and watch the week fill up." />

      <Section title="This week" detail={`${week.weekStart} → ${week.weekEnd}`} />
      <Card>
        <View style={styles.row}>
          {[
            [String(week.sessions), "workouts"],
            [String(week.minutes), "minutes"],
            [String(week.activeDays), "active days"],
          ].map(([value, label]) => (
            <View key={label} style={{ flex: 1, gap: 4 }}>
              <Text style={{ color: c.accent, fontSize: 28, fontWeight: "600" }}>{value}</Text>
              <Copy muted style={{ fontSize: 12 }}>
                {label}
              </Copy>
            </View>
          ))}
        </View>
        {week.goalStreakWeeks > 1 ? <Copy style={{ marginTop: 8 }}>🔥 {week.goalStreakWeeks}-week goal streak</Copy> : null}
      </Card>

      <Section title="Goals" />
      {week.goals.length ? (
        week.goals.map((progress) => (
          <Card key={progress.goal.id} style={{ gap: 10 }}>
            <View style={styles.row}>
              <Text style={[styles.mealTitle, { flex: 1 }]}>{progress.goal.title}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Archive goal ${progress.goal.title}`}
                onPress={() => run({ action: "archive_goal", id: progress.goal.id })}
              >
                <Icon name="archive-outline" size={20} color={c.muted} />
              </Pressable>
            </View>
            <ProgressBar ratio={progress.ratio} />
            <Copy muted style={{ fontSize: 13 }}>
              {describeProgress(progress)}
            </Copy>
          </Card>
        ))
      ) : (
        <Card style={{ gap: 12 }}>
          <Copy>Pick a weekly goal to start. You can change it any time.</Copy>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {goalPresets.map((preset) => (
              <Chip key={preset.label} label={preset.label} selected={false} onPress={() => run(preset.command)} />
            ))}
          </View>
        </Card>
      )}

      <Section title="Quick log" detail="Same words work in Messages" />
      <Card style={{ gap: 12 }}>
        <Field
          label="What did you do?"
          placeholder="ran 5k in 28 min"
          value={quick}
          onChangeText={(text) => {
            setQuick(text);
            setPreview(null);
          }}
          onSubmitEditing={reviewQuick}
          returnKeyType="done"
          maxLength={200}
        />
        {preview ? (
          <View style={{ gap: 10 }}>
            <Copy muted style={{ fontSize: 13 }}>
              {preview.action === "log_workout"
                ? `Log ${preview.durationMin} min ${preview.type}${preview.distanceKm ? `, ${preview.distanceKm} km` : ""}${preview.intensity ? `, ${preview.intensity}` : ""}${preview.date ? ` on ${preview.date}` : " today"}${preview.status === "skipped" ? " as skipped" : ""}?`
                : preview.action === "set_goal"
                  ? `Set a weekly goal of ${preview.target} ${preview.metric === "distanceKm" ? "km" : preview.metric}?`
                  : "Run this?"}
            </Copy>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Button secondary onPress={() => setPreview(null)}>
                  Cancel
                </Button>
              </View>
              <View style={{ flex: 1 }}>
                <Button
                  busy={saving}
                  onPress={async () => {
                    if (await run(preview)) {
                      setPreview(null);
                      setQuick("");
                    }
                  }}
                >
                  Confirm
                </Button>
              </View>
            </View>
          </View>
        ) : (
          <Button secondary icon="sparkles-outline" disabled={!quick.trim()} onPress={reviewQuick}>
            Review
          </Button>
        )}
      </Card>

      <Section title="Log a workout" />
      <Card style={{ gap: 14 }}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {workoutTypes.map((value) => (
            <Chip key={value} label={value} selected={type === value} onPress={() => setType(value)} />
          ))}
        </View>
        <View style={styles.row}>
          <Field label="Minutes" keyboardType="number-pad" placeholder="30" value={duration} onChangeText={setDuration} />
          <Field label="Distance (km, optional)" keyboardType="decimal-pad" placeholder="—" value={distance} onChangeText={setDistance} />
        </View>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {intensities.map((value) => (
            <Chip key={value} label={value} selected={intensity === value} onPress={() => setIntensity(value)} />
          ))}
        </View>
        <Button icon="checkmark" busy={saving} disabled={!duration.trim()} onPress={logManual}>
          Log workout
        </Button>
      </Card>

      {message ? <Notice error={message.error}>{message.text}</Notice> : null}

      <Section title="Recent" />
      {recent.length ? (
        recent.map((session) => (
          <Card key={session.id} style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <Copy style={{ flex: 1 }}>{describeSession(session)}</Copy>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Delete ${describeSession(session)}`}
              onPress={() => run({ action: "delete_workout", id: session.id })}
            >
              <Icon name="trash-outline" size={20} color={c.muted} />
            </Pressable>
          </Card>
        ))
      ) : (
        <Card>
          <Copy muted>No workouts yet. Your first one will show up here.</Copy>
        </Card>
      )}
    </Screen>
  );
}
