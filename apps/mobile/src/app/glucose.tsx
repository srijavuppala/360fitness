import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Button, Card, Copy, Field, Header, Icon, Notice, Screen, Section, styles } from "../components/ui";
import { useApp } from "../data/store";
import {
  classify,
  contexts,
  dispatchGlucose,
  emptyGlucoseState,
  formatGlucose,
  formatGlucoseReply,
  summarize,
  type Band,
  type GlucoseCommand,
  type GlucoseResult,
  type ReadingContext,
  type Unit,
} from "../domain/glucose";
import { localDate } from "../domain/meals";
import { colors as c } from "../theme";

const contextLabel: Record<ReadingContext, string> = {
  fasting: "Fasting",
  before_meal: "Before meal",
  after_meal: "After meal",
  bedtime: "Bedtime",
  overnight: "Overnight",
  other: "Other",
};
const bandColor: Record<Band, string> = {
  very_low: c.danger,
  low: c.orange,
  in_range: c.green,
  high: c.orange,
  very_high: c.danger,
};

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

export default function Glucose() {
  const { state, update, saving } = useApp();
  const glucose = state.glucose ?? emptyGlucoseState();
  const unit = glucose.unit;
  const summary = summarize(glucose, 14, localDate());
  const recent = [...glucose.readings].sort((a, b) => b.takenAt.localeCompare(a.takenAt)).slice(0, 10);

  const [value, setValue] = useState("");
  const [context, setContext] = useState<ReadingContext>("fasting");
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  async function run(command: GlucoseCommand) {
    let result: GlucoseResult | null = null;
    try {
      await update((previous) => {
        const out = dispatchGlucose(previous.glucose ?? emptyGlucoseState(), command, { source: "app" });
        result = out.result;
        return out.result.ok ? { ...previous, glucose: out.state } : previous;
      });
      const r = result as GlucoseResult | null;
      if (r) setMessage({ text: formatGlucoseReply(r), error: !r.ok || (r.action === "log_glucose" && !!r.notice) });
      return r?.ok ?? false;
    } catch {
      setMessage({ text: "That couldn’t be saved on this device. Nothing was changed — try again.", error: true });
      return false;
    }
  }

  async function setUnit(next: Unit) {
    await update((previous) => ({ ...previous, glucose: { ...(previous.glucose ?? emptyGlucoseState()), unit: next } }));
  }

  return (
    <Screen>
      <Header
        back
        eyebrow="Your readings"
        title="Glucose"
        subtitle="Record what your meter or sensor shows. This log helps you and your care team see patterns. It doesn’t give medical advice."
      />
      <Card style={{ gap: 12 }}>
        <View style={styles.row}>
          <Field
            label={`Reading (${unit})`}
            keyboardType="decimal-pad"
            placeholder={unit === "mg/dL" ? "110" : "6.1"}
            value={value}
            onChangeText={setValue}
          />
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {contexts.map((value) => (
            <Chip key={value} label={contextLabel[value]} selected={context === value} onPress={() => setContext(value)} />
          ))}
        </View>
        <Button
          icon="checkmark"
          busy={saving}
          disabled={!value.trim()}
          onPress={async () => {
            if (await run({ action: "log_glucose", value: Number(value.replace(",", ".")), unit, context })) setValue("");
          }}
        >
          Save reading
        </Button>
        <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
          <Copy muted style={{ fontSize: 12 }}>
            Units
          </Copy>
          {(["mg/dL", "mmol/L"] as const).map((u) => (
            <Chip key={u} label={u} selected={unit === u} onPress={() => setUnit(u)} />
          ))}
        </View>
      </Card>

      {message ? <Notice error={message.error}>{message.text}</Notice> : null}

      <Section title="Last 14 days" />
      <Card style={{ gap: 6 }}>
        {summary.count ? (
          <>
            <View style={styles.row}>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={{ color: c.accent, fontSize: 28, fontWeight: "600" }}>{formatGlucose(summary.averageMgdl!, unit)}</Text>
                <Copy muted style={{ fontSize: 12 }}>
                  Average
                </Copy>
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={{ color: c.text, fontSize: 28, fontWeight: "600" }}>{summary.percent!.in_range}%</Text>
                <Copy muted style={{ fontSize: 12 }}>
                  {summary.continuous ? "Time in range" : "Readings in range"}
                </Copy>
              </View>
            </View>
            <Copy muted style={{ fontSize: 12 }}>
              {summary.count} readings on {summary.daysWithReadings} of 14 days. Target {formatGlucose(summary.target.lowMgdl, unit)}–
              {formatGlucose(summary.target.highMgdl, unit)} (
              {summary.target.source === "CLINICIAN_PROVIDED" ? "from your care team" : "general consensus range"}). Days without
              readings aren’t counted.
            </Copy>
            {summary.lowEvents ? (
              <Copy style={{ color: c.danger, fontSize: 13 }}>
                {summary.lowEvents} reading{summary.lowEvents === 1 ? "" : "s"} below 70 mg/dL. Worth sharing with your care team.
              </Copy>
            ) : null}
          </>
        ) : (
          <Copy muted>No readings in the last 14 days.</Copy>
        )}
      </Card>

      <Section title="Recent" />
      {recent.length ? (
        recent.map((r) => (
          <Card key={r.id} style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: bandColor[classify(r.mgdl, glucose.target)] }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.mealTitle}>{formatGlucose(r.mgdl, unit)}</Text>
              <Copy muted style={{ fontSize: 12 }}>
                {contextLabel[r.context]} · {new Date(r.takenAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
              </Copy>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Delete reading ${formatGlucose(r.mgdl, unit)}`}
              onPress={() => run({ action: "delete_glucose", id: r.id })}
            >
              <Icon name="trash-outline" size={20} color={c.muted} />
            </Pressable>
          </Card>
        ))
      ) : (
        <Card>
          <Copy muted>Your readings will show up here.</Copy>
        </Card>
      )}
      <Notice>
        If a reading is low or very high, follow the plan your care team gave you. In an emergency, call 911 or your local emergency number.
      </Notice>
    </Screen>
  );
}
