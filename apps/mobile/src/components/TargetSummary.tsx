import { StyleSheet, Text, View } from "react-native";
import { DASHBOARD_HEALTH_NOTICE } from "../domain/health-copy";
import { NutritionGoalResult, shownValue } from "../domain/nutrition-goal";
import { directionLabel, Targets } from "../domain/targets";
import { colors as c } from "../theme";
import { Copy } from "./ui";

/**
 * Always shows a calorie and four nutrient numbers. Health conditions may
 * change those numbers. They are never replaced with a range or “needs review”.
 */
export function TargetSummary({
  targets,
  goal,
}: {
  targets: Targets;
  goal?: NutritionGoalResult | null;
}) {
  const healthInvolved = !!goal && goal.selectedConditions.length > 0;
  const kcal = goal ? (shownValue(goal, "kcal") ?? targets.kcal) : targets.kcal;
  const macros = (
    [
      ["Protein", "protein", targets.protein, c.green],
      ["Carbs", "carbs", targets.carbs, c.blue],
      ["Fat", "fat", targets.fat, c.orange],
      ["Fiber", "fiber", targets.fiber, c.accent],
    ] as const
  ).map(([label, key, general, color]) => ({
    label,
    color,
    value: goal ? (shownValue(goal, key) ?? general) : general,
  }));
  return (
    <View
      accessibilityLabel={`Daily target ${kcal} kilocalories. ${directionLabel(targets)}. Estimate, not medical advice.`}
      style={s.card}
    >
      <Text style={s.kicker}>YOUR DAILY TARGET</Text>
      <Text style={s.kcal}>
        {kcal.toLocaleString("en-US")}
        <Text style={s.unit}> kcal</Text>
      </Text>
      <Copy muted style={s.direction}>
        {directionLabel(targets)}
        {targets.weeksToGoal
          ? ` · about ${targets.weeksToGoal} ${targets.weeksToGoal === 1 ? "week" : "weeks"}`
          : ""}
      </Copy>
      <View style={s.macros}>
        {macros.map(({ label, value, color }) => (
          <View key={label} style={s.macro}>
            <View style={[s.dot, { backgroundColor: color }]} />
            <Text style={s.macroValue}>
              {value}
              <Text style={s.macroUnit}> g</Text>
            </Text>
            <Copy muted style={s.macroLabel}>
              {label}
            </Copy>
          </View>
        ))}
      </View>
      <Copy muted style={s.disclaimer}>
        {healthInvolved
          ? DASHBOARD_HEALTH_NOTICE
          : "Estimate from a standard formula, not medical advice. A doctor or trainer can adjust this later."}
      </Copy>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: c.accentSoft,
    borderRadius: 22,
    padding: 18,
    gap: 8,
  },
  kicker: {
    color: c.accent,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.2,
  },
  kcal: {
    color: c.text,
    fontSize: 36,
    fontWeight: "600",
    letterSpacing: -1,
  },
  unit: { fontSize: 14, color: c.muted, letterSpacing: 0, fontWeight: "500" },
  direction: { fontSize: 13 },
  macros: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
    marginTop: 6,
  },
  macro: { flex: 1, gap: 2 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  macroValue: { color: c.text, fontSize: 16, fontWeight: "600" },
  macroUnit: { fontSize: 11, color: c.muted, fontWeight: "500" },
  macroLabel: { fontSize: 11 },
  disclaimer: { fontSize: 11, marginTop: 4 },
});
