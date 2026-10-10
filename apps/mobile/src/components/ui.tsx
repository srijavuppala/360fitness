import { ComponentProps, PropsWithChildren } from "react";
import {
  ActivityIndicator,
  ColorValue,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Circle } from "react-native-svg";
import { router } from "expo-router";
import { colors as c } from "../theme";
import { formatValue, Meal, Nutrients, sumNutrition } from "../domain/meals";

export type IconName = ComponentProps<typeof Ionicons>["name"];
export function Icon({
  name,
  color = c.text,
  size = 22,
}: {
  name: IconName;
  color?: ColorValue;
  size?: number;
}) {
  return (
    <Ionicons
      name={name}
      color={color}
      size={size}
      accessible={false}
      importantForAccessibility="no"
    />
  );
}
export function Copy({
  children,
  muted,
  style,
}: PropsWithChildren<{
  muted?: boolean;
  style?: ComponentProps<typeof Text>["style"];
}>) {
  return (
    <Text style={[styles.copy, muted && { color: c.muted }, style]}>
      {children}
    </Text>
  );
}
export function Screen({
  children,
  footer,
}: PropsWithChildren<{ footer?: React.ReactNode }>) {
  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.safe}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scroll}
        >
          <View style={styles.container}>{children}</View>
        </ScrollView>
        {footer ? (
          <SafeAreaView edges={["bottom"]} style={styles.footer}>
            <View style={styles.container}>{footer}</View>
          </SafeAreaView>
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
export function Header({
  eyebrow,
  title,
  subtitle,
  back,
  action,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  back?: boolean;
  action?: React.ReactNode;
}) {
  return (
    <View style={styles.header}>
      {back ? (
        <Pressable
          onPress={() =>
            router.canGoBack() ? router.back() : router.replace("/")
          }
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={styles.back}
        >
          <Icon name="arrow-back" />
        </Pressable>
      ) : null}
      {eyebrow ? (
        <Text style={styles.eyebrow}>{eyebrow.toUpperCase()}</Text>
      ) : null}
      <View style={styles.row}>
        <Text accessibilityRole="header" style={styles.title}>
          {title}
        </Text>
        {action}
      </View>
      {subtitle ? <Copy muted>{subtitle}</Copy> : null}
    </View>
  );
}
export function Button({
  children,
  onPress,
  secondary,
  icon,
  disabled,
  busy,
  accessibilityLabel,
}: PropsWithChildren<{
  onPress: () => void;
  secondary?: boolean;
  icon?: IconName;
  disabled?: boolean;
  busy?: boolean;
  accessibilityLabel?: string;
}>) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        accessibilityLabel ??
        (typeof children === "string" ? children : undefined)
      }
      accessibilityState={{ disabled: !!disabled || !!busy }}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        secondary && styles.secondary,
        (disabled || busy) && { opacity: 0.45 },
        pressed && { opacity: 0.75 },
      ]}
    >
      {busy ? (
        <ActivityIndicator color={secondary ? c.accent : c.onAccent} />
      ) : icon ? (
        <Icon name={icon} color={secondary ? c.accent : c.onAccent} size={20} />
      ) : null}
      <Text style={[styles.buttonLabel, secondary && { color: c.text }]}>
        {children}
      </Text>
    </Pressable>
  );
}
export function Card({
  children,
  style,
}: PropsWithChildren<{ style?: ViewStyle }>) {
  return <View style={[styles.card, style]}>{children}</View>;
}
export function Section({ title, detail }: { title: string; detail?: string }) {
  return (
    <View style={[styles.row, { marginTop: 8 }]}>
      <Text style={styles.section}>{title}</Text>
      {detail ? (
        <Copy muted style={{ fontSize: 12 }}>
          {detail}
        </Copy>
      ) : null}
    </View>
  );
}
export function DemoBanner() {
  return (
    <View style={styles.demo}>
      <View style={styles.dot} />
      <Text style={styles.demoText}>LOCAL DEMO</Text>
      <Text style={[styles.demoText, { color: c.muted, fontWeight: "400" }]}>
        Meals saved on this device
      </Text>
    </View>
  );
}
export function Notice({
  children,
  error,
}: PropsWithChildren<{ error?: boolean }>) {
  return (
    <View
      accessibilityRole={error ? "alert" : undefined}
      style={[styles.notice, error && { borderColor: c.danger }]}
    >
      <Icon
        name={error ? "alert-circle-outline" : "information-circle-outline"}
        size={20}
        color={error ? c.danger : c.accent}
      />
      <Copy
        style={{ flex: 1, color: error ? c.danger : c.muted, fontSize: 13 }}
      >
        {children}
      </Copy>
    </View>
  );
}
export function Field({
  label,
  ...props
}: TextInputProps & { label: string; ref?: React.Ref<TextInput> }) {
  return (
    <View style={{ gap: 8, flex: 1 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor="#737B6D"
        selectionColor={c.accent}
        {...props}
        style={[styles.input, props.style]}
      />
    </View>
  );
}
export function Choice({
  title,
  description,
  icon,
  selected,
  onPress,
}: {
  title: string;
  description: string;
  icon: IconName;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      aria-checked={selected}
      onPress={onPress}
      style={[
        styles.choice,
        selected && { borderColor: c.accent, backgroundColor: c.accentSoft },
      ]}
    >
      <View style={styles.iconBox}>
        <Icon name={icon} color={selected ? c.accent : c.muted} />
      </View>
      <View style={{ flex: 1, gap: 5 }}>
        <Text style={styles.mealTitle}>{title}</Text>
        <Copy muted style={{ fontSize: 13 }}>
          {description}
        </Copy>
      </View>
      <Icon
        name={selected ? "radio-button-on" : "radio-button-off"}
        color={selected ? c.accent : c.muted}
      />
    </Pressable>
  );
}
export const slotIcons: Record<string, IconName> = {
  Breakfast: "sunny-outline",
  Lunch: "partly-sunny-outline",
  Dinner: "moon-outline",
  Snack: "nutrition-outline",
};
export function MealCard({
  meal,
  status,
  onPress,
  subtitle,
}: {
  meal: Meal;
  status?: string;
  onPress: () => void;
  subtitle?: string;
}) {
  const total = sumNutrition(meal.foods);
  const confirmed = status === "Confirmed";
  const skipped = status === "Skipped";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${meal.slot}: ${meal.name}${status ? `, ${status}` : ""}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.mealCard,
        confirmed && { borderColor: c.border },
        pressed && { backgroundColor: c.elevated },
      ]}
    >
      <View
        style={[
          styles.iconBox,
          {
            backgroundColor: confirmed ? c.accentSoft : c.elevated,
          },
        ]}
      >
        <Icon
          name={
            confirmed
              ? "checkmark"
              : skipped
                ? "remove-outline"
                : slotIcons[meal.slot]
          }
          color={confirmed ? c.green : c.muted}
        />
      </View>
      <View style={{ flex: 1, gap: 5 }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 7,
            flexWrap: "wrap",
          }}
        >
          <Text style={styles.slot}>{meal.slot.toUpperCase()}</Text>
          {status ? (
            <View
              style={{
                borderRadius: 6,
                paddingHorizontal: 6,
                paddingVertical: 3,
                backgroundColor: confirmed ? c.accentSoft : c.elevated,
              }}
            >
              <Text
                style={{
                  fontSize: 9,
                  fontWeight: "600",
                  color: confirmed ? c.green : c.muted,
                }}
              >
                {confirmed ? "Logged" : skipped ? "Skipped" : "To log"}
              </Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.mealTitle}>{meal.name}</Text>
        <Copy muted style={{ fontSize: 12 }}>
          {subtitle ??
            (skipped
              ? "No intake recorded"
              : `${formatValue(total.kcal)} kcal · ${formatValue(total.protein)} g protein`)}
        </Copy>
      </View>
      <Icon name="chevron-forward" color={c.muted} size={18} />
    </Pressable>
  );
}
export function Nutrition({ total }: { total: Nutrients }) {
  return (
    <View style={styles.macros}>
      {(
        [
          ["protein", "Protein", c.green],
          ["carbs", "Carbs", c.blue],
          ["fat", "Fat", c.orange],
        ] as const
      ).map(([key, label, color]) => (
        <View key={key} style={styles.macro}>
          <View style={[styles.dot, { backgroundColor: color }]} />
          <Text style={styles.macroValue}>
            {formatValue(total[key])}
            <Text style={styles.unit}> g</Text>
          </Text>
          <Copy muted style={{ fontSize: 12 }}>
            {label}
          </Copy>
        </View>
      ))}
    </View>
  );
}
export function RoutineRing({
  count,
  total,
  size = 138,
}: {
  count: number;
  total: number;
  size?: number;
}) {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  return (
    <View
      accessibilityLabel={`${count} of ${total} usual meals checked in`}
      style={{
        width: size,
        height: size,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Svg
        width={size}
        height={size}
        viewBox="0 0 128 128"
        style={StyleSheet.absoluteFill}
      >
        <Circle
          cx="64"
          cy="64"
          r={radius}
          fill="none"
          stroke={c.border}
          strokeWidth="7"
        />
        <Circle
          cx="64"
          cy="64"
          r={radius}
          fill="none"
          stroke={c.accent}
          strokeWidth="7"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={
            circumference * (1 - Math.min(count / Math.max(total, 1), 1))
          }
          strokeLinecap="round"
          transform="rotate(-90 64 64)"
        />
      </Svg>
      <Text style={{ color: c.text, fontSize: 34, fontWeight: "600" }}>
        {count}
        <Text style={{ color: c.muted, fontSize: 18 }}>/{total}</Text>
      </Text>
      <Text style={{ color: c.muted, fontSize: 10, letterSpacing: 1 }}>
        CHECKED IN
      </Text>
    </View>
  );
}

export const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.background },
  scroll: { padding: 24, paddingBottom: 36, flexGrow: 1 },
  container: { width: "100%", maxWidth: 560, alignSelf: "center", gap: 16 },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 14,
    paddingBottom: 16,
    backgroundColor: c.background,
    borderTopWidth: 1,
    borderColor: c.border,
  },
  copy: { color: c.text, fontSize: 15, lineHeight: 23 },
  header: { gap: 9, marginBottom: 4 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  eyebrow: {
    color: c.accent,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.8,
  },
  title: {
    color: c.text,
    fontSize: 34,
    lineHeight: 41,
    fontWeight: "600",
    letterSpacing: -1.1,
    flexShrink: 1,
  },
  back: { width: 44, height: 44, justifyContent: "center", marginLeft: -6 },
  button: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: c.accent,
    minHeight: 56,
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 15,
  },
  secondary: {
    backgroundColor: c.elevated,
    borderWidth: 1,
    borderColor: c.border,
  },
  buttonLabel: {
    color: c.onAccent,
    fontSize: 15,
    fontWeight: "700",
    textAlign: "center",
  },
  card: {
    backgroundColor: c.surface,
    borderRadius: 24,
    padding: 20,
    gap: 16,
    borderWidth: 1,
    borderColor: c.border,
  },
  section: {
    color: c.text,
    fontSize: 19,
    fontWeight: "600",
    letterSpacing: -0.3,
  },
  demo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    flexWrap: "wrap",
    paddingVertical: 8,
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: c.accent },
  demoText: {
    color: c.accent,
    fontSize: 9,
    letterSpacing: 0.5,
    fontWeight: "700",
  },
  notice: {
    flexDirection: "row",
    gap: 10,
    padding: 16,
    backgroundColor: c.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: c.border,
  },
  fieldLabel: { color: c.muted, fontSize: 12, fontWeight: "600" },
  input: {
    color: c.text,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 13,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 16,
    minHeight: 50,
  },
  choice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    padding: 18,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surface,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: c.elevated,
    alignItems: "center",
    justifyContent: "center",
  },
  mealCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 20,
    backgroundColor: c.surface,
  },
  mealTitle: { color: c.text, fontSize: 15, fontWeight: "600", lineHeight: 21 },
  slot: { color: c.muted, fontSize: 9, letterSpacing: 1, fontWeight: "600" },
  macros: {
    flexDirection: "row",
    paddingTop: 18,
    borderTopWidth: 1,
    borderColor: c.border,
  },
  macro: { flex: 1, gap: 5 },
  macroValue: { color: c.text, fontSize: 23, fontWeight: "600" },
  unit: { color: c.muted, fontSize: 12, fontWeight: "400" },
});
