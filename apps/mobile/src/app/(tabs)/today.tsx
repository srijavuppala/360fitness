import { useEffect, useState } from "react";
import {
  AppState as NativeAppState,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import {
  Button,
  Copy,
  Icon,
  Nutrition,
  RoutineRing,
} from "../../components/ui";
import {
  DetailSheet,
  MobileFrame,
  SettingsRow,
} from "../../components/MobileFrame";
import { useApp } from "../../data/store";
import { dailyNutrition, formatValue, localDate } from "../../domain/meals";
import { colors as c } from "../../theme";

export default function Today() {
  const { state } = useApp();
  const [date, setDate] = useState(localDate);
  const [details, setDetails] = useState<"nutrition" | "meals" | null>(null);
  useEffect(() => {
    const refresh = () => setDate(localDate());
    const timer = setInterval(refresh, 15000);
    const subscription = NativeAppState.addEventListener("change", refresh);
    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, []);
  const entries = state.entries.filter((entry) => entry.date === date);
  const total = dailyNutrition(state.entries, date);
  const count = state.templates.filter((meal) =>
    entries.some((entry) => entry.id === meal.id),
  ).length;
  const extra = entries.filter(
    (entry) => !state.templates.some((meal) => meal.id === entry.id),
  );
  const nextMeal = state.templates.find(
    (meal) => !entries.some((entry) => entry.id === meal.id),
  );
  const confirmedCount = entries.filter(
    (entry) => entry.status === "confirmed",
  ).length;
  return (
    <MobileFrame
      bottomInset={false}
      header={
        <View style={s.row}>
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={s.date}>
              {new Date(`${date}T12:00:00`).toLocaleDateString("en-US", {
                weekday: "long",
                month: "short",
                day: "numeric",
              })}
            </Text>
            <Text accessibilityRole="header" style={s.title}>
              Today
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open your profile"
            onPress={() => router.push("/(tabs)/profile")}
            style={s.avatar}
          >
            <Icon name="person-outline" color={c.accent} />
          </Pressable>
        </View>
      }
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="View today's nutrition details"
        onPress={() => setDetails("nutrition")}
        style={s.summary}
      >
        <View style={s.row}>
          <View style={{ flex: 1, gap: 5 }}>
            <Text style={s.label}>LOGGED SO FAR</Text>
            <Text style={s.energy}>
              {formatValue(total.kcal)}
              <Text style={s.unit}> kcal</Text>
            </Text>
            <Text style={s.date}>
              {confirmedCount} meals confirmed · estimates
            </Text>
          </View>
          <RoutineRing count={count} total={state.templates.length} size={82} />
        </View>
        <View
          style={[
            s.row,
            {
              borderTopWidth: 1,
              borderColor: c.border,
              paddingTop: 12,
              justifyContent: "space-between",
            },
          ]}
        >
          <Text style={s.date}>Nutrition & check-in details</Text>
          <Icon name="chevron-forward" color={c.accent} size={16} />
        </View>
      </Pressable>
      <View style={s.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Search food"
          onPress={() => router.push({ pathname: "/search", params: { date } })}
          style={s.action}
        >
          <Icon name="search-outline" color={c.accent} />
          <Text style={s.actionText}>Search food</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Scan food"
          onPress={() => router.push("/scan")}
          style={s.action}
        >
          <Icon name="scan-outline" color={c.accent} />
          <Text style={s.actionText}>Scan food</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Log a meal"
          onPress={() => router.push("/add")}
          style={s.action}
        >
          <Icon name="add-circle-outline" color={c.accent} />
          <Text style={s.actionText}>Log a meal</Text>
        </Pressable>
      </View>
      <View style={s.next}>
        <Text style={s.label}>
          {nextMeal
            ? `UP NEXT · ${nextMeal.slot.toUpperCase()}`
            : "ALL CHECKED IN"}
        </Text>
        <Text style={s.mealName} numberOfLines={2}>
          {nextMeal?.name ?? "Your usual meals are checked in."}
        </Text>
        {nextMeal ? (
          <Button
            onPress={() =>
              router.push({
                pathname: "/meal",
                params: { id: nextMeal.id, date },
              })
            }
          >
            Check in
          </Button>
        ) : (
          <Copy muted style={{ fontSize: 13 }}>
            You can still make changes or log something different.
          </Copy>
        )}
      </View>
      <SettingsRow
        title="Today's meals"
        detail={`${entries.length} checked in · ${state.templates.length} usual meals`}
        icon="restaurant-outline"
        onPress={() => setDetails("meals")}
      />
      <DetailSheet
        visible={details !== null}
        title={details === "nutrition" ? "Today's nutrition" : "Today's meals"}
        onClose={() => setDetails(null)}
      >
        {details === "nutrition" ? (
          <>
            <Text style={s.energy}>
              {formatValue(total.kcal)}
              <Text style={s.unit}> kcal logged</Text>
            </Text>
            <Nutrition total={total} />
            <Copy muted>
              Only confirmed meals contribute to these estimates. Unlogged and
              skipped meals don’t count as eaten.
            </Copy>
          </>
        ) : (
          <>
            {state.templates.map((template) => {
              const entry = entries.find((item) => item.id === template.id);
              return (
                <SettingsRow
                  key={template.id}
                  title={(entry ?? template).name}
                  detail={`${template.slot} · ${entry ? (entry.status === "confirmed" ? "Confirmed" : "Skipped") : "Not logged"}`}
                  onPress={() => {
                    setDetails(null);
                    router.push({
                      pathname: "/meal",
                      params: { id: template.id, date },
                    });
                  }}
                />
              );
            })}
            {extra.map((entry) => (
              <SettingsRow
                key={entry.id}
                title={entry.name}
                detail={entry.status === "confirmed" ? "Confirmed" : "Skipped"}
                onPress={() => {
                  setDetails(null);
                  router.push({
                    pathname: "/meal",
                    params: { id: entry.id, date },
                  });
                }}
              />
            ))}
            <Button
              secondary
              icon="add"
              onPress={() => {
                setDetails(null);
                router.push("/add");
              }}
            >
              Log a different meal
            </Button>
          </>
        )}
      </DetailSheet>
    </MobileFrame>
  );
}
const s = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  title: { color: c.text, fontSize: 28, fontWeight: "700" },
  date: { color: c.muted, fontSize: 12 },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: c.accentSoft,
  },
  summary: { borderRadius: 22, backgroundColor: "white", padding: 18, gap: 14 },
  label: {
    color: c.accent,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.2,
  },
  energy: {
    color: c.text,
    fontSize: 42,
    fontWeight: "600",
    letterSpacing: -1.5,
  },
  unit: { fontSize: 13, color: c.muted, letterSpacing: 0 },
  actions: { flexDirection: "row", gap: 10 },
  action: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 16,
    minHeight: 60,
  },
  actionText: { color: c.text, fontSize: 14, fontWeight: "600" },
  next: {
    backgroundColor: c.accentSoft,
    borderRadius: 22,
    padding: 18,
    gap: 12,
  },
  mealName: { color: c.text, fontSize: 20, lineHeight: 26, fontWeight: "600" },
});
