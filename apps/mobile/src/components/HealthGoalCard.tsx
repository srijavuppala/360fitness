import { StyleSheet, Text, View } from "react-native";
import {
  nutrientLabel,
  nutrientUnit,
  reasonText,
} from "../domain/health-copy";
import type { NutrientKey } from "../domain/health-context";
import type { NutritionGoalResult } from "../domain/nutrition-goal";
import { colors as c } from "../theme";
import { Button, Copy } from "./ui";

const rows: NutrientKey[] = ["kcal", "protein", "carbs", "fat", "fiber"];

/**
 * Compact goal summary: the numbers, a one-line note when something needs a
 * second look, and a single disclaimer. Everything is decided upstream by
 * `buildNutritionGoal`; this component calculates and judges nothing.
 */
export function HealthGoalCard({
  goal,
  onReview,
}: {
  goal: NutritionGoalResult;
  onReview?: () => void;
}) {
  const general = goal.generalTarget;
  const problem = goal.reasons
    .map((reason) => reasonText[reason])
    .find((text): text is string => !!text);
  const flagged = goal.flagged.length > 0;
  return (
    <View style={s.card}>
      <Text style={s.kicker}>YOUR DAILY TARGET</Text>
      {general ? (
        <>
          <View style={s.grid}>
            {rows.map((key) => {
              const shown = goal.displayedTarget[key];
              return (
                <View key={key} style={s.item}>
                  <Text style={s.value}>
                    {shown?.value ?? "—"}
                    <Text style={s.unit}> {nutrientUnit[key]}</Text>
                  </Text>
                  <Text style={s.label}>
                    {nutrientLabel[key]}
                    {shown?.flagged ? " *" : ""}
                    {shown?.source === "CLINICIAN_PROVIDED" ? " (care team)" : ""}
                  </Text>
                </View>
              );
            })}
          </View>
          {flagged ? (
            <Copy muted style={s.small}>
              * May need adjusting for your health. Please check with your
              doctor or dietitian.
            </Copy>
          ) : null}
        </>
      ) : goal.kcalRange ? (
        <Text style={s.text}>
          About {goal.kcalRange.min}–{goal.kcalRange.max} kcal a day
        </Text>
      ) : null}
      {problem ? <Copy style={s.small}>{problem}</Copy> : null}
      {onReview && goal.status === "INSUFFICIENT_DATA" ? (
        <Button secondary icon="options-outline" onPress={onReview}>
          Review my answers
        </Button>
      ) : null}
      <Copy muted style={s.small}>
        Estimate, not medical advice.
      </Copy>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: c.accentSoft,
    borderRadius: 22,
    padding: 18,
    gap: 10,
  },
  kicker: {
    color: c.accent,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.2,
  },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 14 },
  item: { minWidth: 72, gap: 2 },
  value: { color: c.text, fontSize: 18, fontWeight: "600" },
  unit: { color: c.muted, fontSize: 11, fontWeight: "500" },
  label: { color: c.muted, fontSize: 11 },
  text: { color: c.text, fontSize: 15 },
  small: { fontSize: 11, lineHeight: 16 },
});
