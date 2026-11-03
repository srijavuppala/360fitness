import { useRef } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { HistoryDay } from "../domain/analytics";
import { formatValue, Nutrients } from "../domain/meals";
import { colors as c } from "../theme";
import { ChartCard } from "./ChartCard";
import { Copy, styles } from "./ui";

export function HistoryChart({
  days,
  selected,
  nutrient,
  onSelect,
  target,
}: {
  days: HistoryDay[];
  selected: string;
  nutrient: "kcal" | "protein";
  onSelect: (date: string) => void;
  target?: number | null;
}) {
  const scroll = useRef<ScrollView>(null);
  const value = (day: HistoryDay): Nutrients["kcal"] =>
    day.nutrition?.[nutrient] ?? null;
  const max = Math.max(1, target ?? 0, ...days.map((day) => value(day) ?? 0));
  const unit = nutrient === "kcal" ? "kcal" : "g protein";
  const targetHeight =
    target && target > 0 ? Math.max(3, (target / max) * 112) : null;
  return (
    <ChartCard
      title={nutrient === "kcal" ? "Calories logged" : "Protein logged"}
    >
      <View style={styles.row}>
        <Copy muted style={{ fontSize: 12 }}>
          Tap a day to see its meals
        </Copy>
        <Copy muted style={{ fontSize: 12 }}>
          {formatValue(days.some((day) => value(day) !== null) ? max : null)}{" "}
          {unit}
        </Copy>
      </View>
      <ScrollView
        ref={scroll}
        horizontal
        onContentSizeChange={() =>
          scroll.current?.scrollToEnd({ animated: false })
        }
        showsHorizontalScrollIndicator={days.length > 7}
      >
        <View style={{ flexDirection: "row", gap: 4, height: 164 }}>
          {targetHeight !== null ? (
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                bottom: 24,
                height: targetHeight,
                borderTopWidth: 1,
                borderStyle: "dashed",
                borderColor: c.muted,
              }}
              accessibilityLabel={`Daily target ${formatValue(target ?? null)} ${unit}`}
            />
          ) : null}
          {days.map((day) => {
            const amount = value(day);
            return (
              <Pressable
                key={day.date}
                accessibilityRole="button"
                accessibilityLabel={`${day.date}: ${amount === null ? "No complete estimate" : `${formatValue(amount)} ${unit}`}`}
                accessibilityState={{ selected: selected === day.date }}
                onPress={() => onSelect(day.date)}
                style={{
                  width: 36,
                  justifyContent: "flex-end",
                  alignItems: "center",
                  borderRadius: 6,
                  backgroundColor:
                    selected === day.date ? c.accentSoft : "transparent",
                  paddingTop: 8,
                }}
              >
                {amount === null ? (
                  <Text style={{ color: c.muted, fontSize: 12 }}>–</Text>
                ) : (
                  <View
                    style={{
                      width: "80%",
                      minHeight: 3,
                      height: Math.max(3, (amount / max) * 112),
                      borderRadius: 5,
                      backgroundColor: nutrient === "kcal" ? c.accent : c.green,
                    }}
                  />
                )}
                <Text style={{ color: c.muted, fontSize: 10, marginTop: 8 }}>
                  {Number(day.date.slice(-2))}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
      <View style={styles.row}>
        <Copy muted style={{ fontSize: 11 }}>
          {days[0]?.date.slice(5)}
        </Copy>
        <Copy muted style={{ fontSize: 11 }}>
          {days.at(-1)?.date.slice(5)}
        </Copy>
      </View>
      <Copy muted style={{ fontSize: 12 }}>
        {target
          ? `Dashed line is your ${formatValue(target)} ${unit} daily target. `
          : ""}
        Gaps mean no complete estimate. Skipped meals and unknown values are
        excluded from averages.
      </Copy>
    </ChartCard>
  );
}
