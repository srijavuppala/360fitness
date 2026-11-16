import { StyleSheet, Text, View } from "react-native";
import {
  DISCLAIMER,
  explanation,
  KIDNEY_DISCLAIMER,
  noticeText,
  nutrientLabel,
  nutrientUnit,
  statusLabel,
} from "../domain/health-copy";
import type { NutrientKey } from "../domain/health-context";
import type { NutritionGoalResult } from "../domain/nutrition-goal";
import { colors as c } from "../theme";
import { Copy } from "./ui";

const rows: NutrientKey[] = ["kcal", "protein", "carbs", "fat"];

/**
 * Side-by-side view of the general estimate and the health-aware outcome. It
 * only presents values already decided by `buildNutritionGoal`; it calculates
 * and judges nothing itself.
 */
export function HealthGoalCard({ goal }: { goal: NutritionGoalResult }) {
  const general = goal.generalTarget;
  return (
    <View
      accessibilityLabel={`Nutrition goal status: ${statusLabel[goal.recommendationStatus]}`}
      style={s.card}
    >
      <Text style={s.kicker}>HEALTH-AWARE GOAL</Text>
      <Text accessibilityRole="header" style={s.status}>
        {statusLabel[goal.recommendationStatus]}
      </Text>
      <Copy muted style={s.small}>
        {explanation(goal.recommendationStatus)}
      </Copy>

      <View style={s.table}>
        <View style={s.row}>
          <Text style={[s.head, s.label]} />
          <Text style={[s.head, s.cell]}>Previous general goal</Text>
          <Text style={[s.head, s.cell]}>Health-aware goal</Text>
        </View>
        {rows.map((key) => {
          const shown = goal.displayedTarget[key];
          return (
            <View key={key} style={s.row}>
              <Text style={[s.label, s.text]}>{nutrientLabel[key]}</Text>
              <Text style={[s.cell, s.text]}>
                {general[key]} {nutrientUnit[key]}
              </Text>
              <View style={s.cell}>
                {shown ? (
                  <>
                    <Text style={s.text}>
                      {shown.value} {nutrientUnit[key]}
                    </Text>
                    <Text style={s.tag}>
                      {shown.source === "CLINICIAN_PROVIDED"
                        ? "From your care team"
                        : "General estimate"}
                    </Text>
                  </>
                ) : (
                  <>
                    <Text style={[s.text, s.review]}>Needs review</Text>
                    <Text style={s.tag}>Withheld on purpose</Text>
                  </>
                )}
              </View>
            </View>
          );
        })}
      </View>

      {goal.notices.map((key) => (
        <Copy key={key} muted style={s.small}>
          {noticeText[key]}
        </Copy>
      ))}
      {goal.notices.includes("kidney") ? (
        <Copy muted style={s.small}>
          {KIDNEY_DISCLAIMER}
        </Copy>
      ) : null}
      <Copy muted style={s.fine}>
        {DISCLAIMER}
      </Copy>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: c.elevated,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: c.border,
    padding: 18,
    gap: 10,
  },
  kicker: {
    color: c.accent,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.2,
  },
  status: { color: c.text, fontSize: 18, fontWeight: "700" },
  table: { gap: 8, marginTop: 4 },
  row: { flexDirection: "row", gap: 8, alignItems: "flex-start" },
  label: { flex: 1.1 },
  cell: { flex: 1.4 },
  head: { color: c.muted, fontSize: 11, fontWeight: "600" },
  text: { color: c.text, fontSize: 14 },
  review: { color: c.accent, fontWeight: "600" },
  tag: { color: c.muted, fontSize: 11 },
  small: { fontSize: 12, lineHeight: 18 },
  fine: { fontSize: 11, lineHeight: 16 },
});
