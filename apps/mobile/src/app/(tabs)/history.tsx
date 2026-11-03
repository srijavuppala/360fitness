// Period controls and summary layout adapted from CalorieTracker app/(tabs)/stats.tsx.
// Copyright (c) 2026 AtharvaK51 (MIT). See licenses/CalorieTracker-MIT.txt.
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import {
  Card,
  Copy,
  DemoBanner,
  Header,
  MealCard,
  Nutrition,
  Screen,
  Section,
  styles,
} from "../../components/ui";
import { HistoryChart } from "../../components/HistoryChart";
import { historyDays, averageLogged, daysOnTarget } from "../../domain/analytics";
import { formatValue, localDate } from "../../domain/meals";
import { calculateTargets } from "../../domain/targets";
import { useApp } from "../../data/store";
import { colors as c } from "../../theme";

export default function History() {
  const { state } = useApp();
  const [period, setPeriod] = useState<7 | 30>(7);
  const [date, setDate] = useState(localDate);
  const [nutrient, setNutrient] = useState<"kcal" | "protein">("kcal");
  const days = historyDays(state.entries, period);
  const selected =
    days.find((day) => day.date === date) ?? days[days.length - 1];
  const entries = state.entries.filter((entry) => entry.date === selected.date);
  const loggedDays = days.filter((day) => day.meals > 0).length;
  const knownDays = days.filter(
    (day) => day.nutrition?.[nutrient] != null,
  ).length;
  const targets = state.profile
    ? calculateTargets(state.profile.answers)
    : null;
  const dailyTarget =
    nutrient === "kcal" ? targets?.kcal : targets?.protein;
  const onTarget = dailyTarget
    ? daysOnTarget(days, dailyTarget, nutrient)
    : 0;
  return (
    <Screen>
      <DemoBanner />
      <Header
        eyebrow="A little perspective"
        title="Your rhythm, over time."
        subtitle="A picture of what you’ve logged. Every day is a fresh start."
      />
      <View style={styles.row}>
        {([7, 30] as const).map((value) => (
          <Pressable
            key={value}
            accessibilityRole="button"
            accessibilityLabel={`${value} days`}
            accessibilityState={{ selected: period === value }}
            onPress={() => setPeriod(value)}
            style={{
              flex: 1,
              padding: 14,
              borderRadius: 16,
              alignItems: "center",
              backgroundColor: period === value ? c.accent : c.elevated,
            }}
          >
            <Text
              style={{
                color: period === value ? c.onAccent : c.text,
                fontWeight: "600",
              }}
            >
              {value} days
            </Text>
          </Pressable>
        ))}
      </View>
      <Card>
        <View style={styles.row}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={{ color: c.accent, fontSize: 30, fontWeight: "600" }}>
              {formatValue(averageLogged(days, nutrient))}
            </Text>
            <Copy muted style={{ fontSize: 12 }}>
              {nutrient === "kcal"
                ? "Average kcal logged"
                : "Average protein (g)"}
            </Copy>
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={{ color: c.text, fontSize: 30, fontWeight: "600" }}>
              {loggedDays}
              <Text style={{ color: c.muted, fontSize: 16 }}> / {period}</Text>
            </Text>
            <Copy muted style={{ fontSize: 12 }}>
              Days with meals
            </Copy>
          </View>
        </View>
        {targets ? (
          <Copy muted style={{ fontSize: 12, marginTop: 10 }}>
            {onTarget} of {knownDays} logged{" "}
            {knownDays === 1 ? "day" : "days"} within 10% of your{" "}
            {formatValue(dailyTarget ?? null)}{" "}
            {nutrient === "kcal" ? "kcal" : "g protein"} target.
          </Copy>
        ) : null}
        <Copy muted style={{ fontSize: 12 }}>
          Average uses {knownDays} {knownDays === 1 ? "day" : "days"} with
          complete {nutrient === "kcal" ? "calorie" : "protein"} estimates.
          Logged amounts may be only part of a day.
        </Copy>
      </Card>
      <View style={styles.row}>
        {(["kcal", "protein"] as const).map((key) => (
          <Pressable
            key={key}
            accessibilityRole="button"
            accessibilityState={{ selected: nutrient === key }}
            onPress={() => setNutrient(key)}
            style={{
              flex: 1,
              padding: 12,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: nutrient === key ? c.accent : c.border,
              alignItems: "center",
            }}
          >
            <Copy style={{ color: nutrient === key ? c.accent : c.muted }}>
              {key === "kcal" ? "Calories" : "Protein"}
            </Copy>
          </Pressable>
        ))}
      </View>
      <HistoryChart
        days={days}
        selected={selected.date}
        nutrient={nutrient}
        onSelect={setDate}
        target={dailyTarget}
      />
      <Section
        title={new Date(`${selected.date}T12:00:00`).toLocaleDateString(
          "en-US",
          { month: "long", day: "numeric" },
        )}
        detail={selected.date === localDate() ? "TODAY" : undefined}
      />
      {selected.nutrition ? (
        <Card>
          <Text style={{ color: c.text, fontSize: 30, fontWeight: "600" }}>
            {formatValue(selected.nutrition.kcal)}
            <Text style={{ fontSize: 14, color: c.muted }}> kcal logged</Text>
          </Text>
          <Nutrition
            total={selected.nutrition}
            target={
              targets
                ? {
                    protein: targets.protein,
                    carbs: targets.carbs,
                    fat: targets.fat,
                  }
                : undefined
            }
          />
        </Card>
      ) : (
        <Card>
          <Copy>
            {entries.length
              ? "Only skipped meals recorded."
              : "Nothing recorded for this day."}
          </Copy>
          <Copy muted>
            No confirmed intake to show. A missing day is never counted as zero
            intake.
          </Copy>
        </Card>
      )}
      {entries.map((entry) => (
        <MealCard
          key={entry.id}
          meal={entry}
          status={entry.status === "confirmed" ? "Confirmed" : "Skipped"}
          onPress={() =>
            router.push({
              pathname: "/meal",
              params: { id: entry.id, date: selected.date },
            })
          }
        />
      ))}
    </Screen>
  );
}
