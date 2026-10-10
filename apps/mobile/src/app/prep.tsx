import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Redirect, router } from "expo-router";
import { Button, Copy, Icon, Notice } from "../components/ui";
import {
  DetailSheet,
  MobileFrame,
  SettingsRow,
} from "../components/MobileFrame";
import { PrepComposer } from "../components/PrepComposer";
import { PrepCloud } from "../components/PrepCloud";
import { PrepGuide } from "../components/PrepGuide";
import { useApp } from "../data/store";
import { localDate } from "../domain/meals";
import {
  emptyPrep,
  advancePrepStep,
  groceryList,
  logPrepPortion,
  moveWeek,
  PrepBatch,
  toggleGrocery,
  weekDays,
} from "../domain/meal-prep";
import { colors as c } from "../theme";

export default function MealPrepScreen() {
  const { state, ready, update, saving } = useApp();
  const [date, setDate] = useState(localDate);
  const [tab, setTab] = useState<"plan" | "groceries">("plan");
  const [sheet, setSheet] = useState<
    "add" | "cloud" | "batch" | "guide" | "edit" | null
  >(null);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [remove, setRemove] = useState(false);
  const [groceryPage, setGroceryPage] = useState(0);
  if (!ready) return <Redirect href="/" />;
  const prep = state.mealPrep ?? emptyPrep();
  const days = weekDays(date);
  const weekly = prep.batches.filter((batch) => days.includes(batch.date));
  const daily = weekly.filter((batch) => batch.date === date);
  const groceries = groceryList(prep, date);
  const groceryPages = Math.max(1, Math.ceil(groceries.length / 3));
  const currentGroceryPage = Math.min(groceryPage, groceryPages - 1);
  const batch = prep.batches.find((item) => item.id === batchId);
  async function run(change: Parameters<typeof update>[0], success?: string) {
    setError("");
    setMessage("");
    try {
      await update(change);
      if (success) setMessage(success);
      return true;
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Couldn’t save your change. Please try again.",
      );
      return false;
    }
  }
  function openBatch(item: PrepBatch) {
    setBatchId(item.id);
    setSheet("batch");
    setMessage("");
    setRemove(false);
  }
  return (
    <MobileFrame
      header={
        <View style={s.row}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back to my plan"
            onPress={() =>
              router.canGoBack()
                ? router.back()
                : router.replace("/(tabs)/plan")
            }
            style={s.icon}
          >
            <Icon name="arrow-back" />
          </Pressable>
          <Text accessibilityRole="header" style={s.title}>
            Meal prep
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Meal prep cloud backup"
            onPress={() => setSheet("cloud")}
            style={s.icon}
          >
            <Icon name="cloud-outline" color={c.accent} />
          </Pressable>
        </View>
      }
      footer={
        <Button
          icon="add"
          onPress={() => {
            setBatchId(null);
            setSheet("add");
          }}
        >
          Plan a prep batch
        </Button>
      }
    >
      <View style={s.row}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Previous week"
          onPress={() => {
            setDate(moveWeek(date, -1));
            setGroceryPage(0);
          }}
          style={s.icon}
        >
          <Icon name="chevron-back" />
        </Pressable>
        <Text style={s.week}>
          Week of{" "}
          {new Date(`${days[0]}T12:00:00`).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Next week"
          onPress={() => {
            setDate(moveWeek(date, 1));
            setGroceryPage(0);
          }}
          style={s.icon}
        >
          <Icon name="chevron-forward" />
        </Pressable>
      </View>
      {tab === "plan" ? (
        <>
          <View style={[s.row, { gap: 1, marginHorizontal: -8 }]}>
            {days.map((day) => (
              <Pressable
                key={day}
                accessibilityRole="radio"
                accessibilityLabel={`Prep day ${day}`}
                aria-checked={date === day}
                onPress={() => setDate(day)}
                style={[s.day, date === day && { backgroundColor: c.accent }]}
              >
                <Text style={[s.dayLabel, date === day && { color: "white" }]}>
                  {new Date(`${day}T12:00:00`)
                    .toLocaleDateString("en-US", { weekday: "short" })
                    .slice(0, 1)}
                </Text>
                <Text style={[s.dayNumber, date === day && { color: "white" }]}>
                  {Number(day.slice(-2))}
                </Text>
              </Pressable>
            ))}
          </View>
          <View style={s.overview}>
            <Text style={s.portions}>
              {weekly.reduce((sum, b) => sum + b.servings, 0)}{" "}
              <Text style={{ fontSize: 16 }}>servings planned</Text>
            </Text>
            <Copy muted style={{ fontSize: 12 }}>
              {weekly.filter((b) => b.prepared).length} of {weekly.length}{" "}
              batches prepared this week
            </Copy>
          </View>
        </>
      ) : null}
      <View style={s.segments}>
        {(["plan", "groceries"] as const).map((value) => (
          <Pressable
            key={value}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === value }}
            aria-selected={tab === value}
            onPress={() => setTab(value)}
            style={[s.segment, tab === value && { backgroundColor: "white" }]}
          >
            <Text style={{ color: c.text, fontWeight: "600", fontSize: 14 }}>
              {value === "plan"
                ? "Prep plan"
                : `Groceries · ${groceries.length}`}
            </Text>
          </Pressable>
        ))}
      </View>
      {tab === "plan" ? (
        daily.length ? (
          <View style={{ gap: 8 }}>
            {daily.map((item) => (
              <SettingsRow
                key={item.id}
                title={item.meal.name}
                detail={`${item.servings} servings · ${item.meal.slot} · ${item.prepared ? "Prepared" : "To prep"}`}
                icon={
                  item.prepared
                    ? "checkmark-circle-outline"
                    : "restaurant-outline"
                }
                onPress={() => openBatch(item)}
              />
            ))}
          </View>
        ) : (
          <View style={s.empty}>
            <Icon name="restaurant-outline" size={32} color={c.accent} />
            <Text style={s.emptyTitle}>Make room for the week.</Text>
            <Copy muted style={{ textAlign: "center", fontSize: 13 }}>
              Plan a batch for this day. Try a starter recipe, use a usual meal
              or describe one with Gemini.
            </Copy>
          </View>
        )
      ) : (
        <>
          <Copy muted style={{ fontSize: 12 }}>
            Combined ingredients for this week’s batches. Units stay separate;
            cooked and raw weights aren’t converted.
          </Copy>
          {groceries.length ? (
            groceries
              .slice(currentGroceryPage * 3, currentGroceryPage * 3 + 3)
              .map((item) => (
                <Pressable
                  key={item.key}
                  accessibilityRole="checkbox"
                  accessibilityLabel={`${item.name}, ${Number(item.quantity.toFixed(3))} ${item.unit}`}
                  aria-checked={prep.checked.includes(item.key)}
                  disabled={saving}
                  onPress={() =>
                    void run((previous) => toggleGrocery(previous, item.key))
                  }
                  style={s.grocery}
                >
                  <Icon
                    name={
                      prep.checked.includes(item.key)
                        ? "checkbox"
                        : "square-outline"
                    }
                    color={c.accent}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: c.text, fontSize: 15 }}>
                      {item.name}
                    </Text>
                    <Text style={{ color: c.muted, fontSize: 12 }}>
                      {Number(item.quantity.toFixed(3))} {item.unit}
                    </Text>
                  </View>
                </Pressable>
              ))
          ) : (
            <Copy muted>Add a prep batch to build your grocery list.</Copy>
          )}
          {groceryPages > 1 ? (
            <View style={s.row}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Previous groceries"
                disabled={currentGroceryPage === 0}
                onPress={() => setGroceryPage(currentGroceryPage - 1)}
                style={s.icon}
              >
                <Icon name="chevron-back" />
              </Pressable>
              <Text style={s.week}>
                {currentGroceryPage + 1} of {groceryPages}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Next groceries"
                disabled={currentGroceryPage === groceryPages - 1}
                onPress={() => setGroceryPage(currentGroceryPage + 1)}
                style={s.icon}
              >
                <Icon name="chevron-forward" />
              </Pressable>
            </View>
          ) : null}
        </>
      )}
      {error ? <Notice error>{error}</Notice> : null}
      <DetailSheet
        visible={sheet !== null}
        title={
          sheet === "cloud"
            ? "Meal prep backup"
            : sheet === "guide"
              ? "Prep, one step at a time"
              : sheet === "batch"
                ? "Your prep batch"
                : sheet === "edit"
                  ? "Edit prep batch"
                  : "Plan a batch"
        }
        onClose={() => {
          setSheet(null);
          setMessage("");
          setRemove(false);
        }}
      >
        {sheet === "cloud" ? (
          <PrepCloud />
        ) : sheet === "guide" && batch ? (
          <>
            <PrepGuide
              key={batch.id}
              batch={batch}
              saving={saving}
              onAdvance={(step) =>
                void run((previous) =>
                  advancePrepStep(previous, batch.id, step),
                )
              }
              onBack={() => setSheet("batch")}
            />
            {error ? <Notice error>{error}</Notice> : null}
          </>
        ) : sheet === "add" || sheet === "edit" ? (
          <PrepComposer
            key={sheet === "edit" ? batch?.id : "new"}
            date={date}
            initial={sheet === "edit" ? batch : undefined}
            onDone={() => setSheet(null)}
          />
        ) : sheet === "batch" && batch ? (
          <>
            <Text style={s.emptyTitle}>{batch.meal.name}</Text>
            <Copy muted>
              {batch.servings} servings · {batch.meal.slot} · Prep on{" "}
              {batch.date}
            </Copy>
            {batch.guide ? (
              <SettingsRow
                title={
                  batch.guide.completed === batch.guide.steps.length
                    ? "Review prep guide"
                    : batch.guide.completed === 0
                      ? "Start guided prep"
                      : "Continue prep guide"
                }
                detail={`${batch.guide.completed} of ${batch.guide.steps.length} steps complete`}
                icon="play-outline"
                onPress={() => setSheet("guide")}
              />
            ) : null}
            <Button
              busy={saving}
              icon="checkmark"
              onPress={() =>
                void run((previous) => ({
                  ...previous,
                  mealPrep: {
                    ...(previous.mealPrep ?? emptyPrep()),
                    batches: (previous.mealPrep?.batches ?? []).map((item) =>
                      item.id === batch.id
                        ? { ...item, prepared: !item.prepared }
                        : item,
                    ),
                  },
                }))
              }
            >
              {batch.prepared ? "Mark as not prepared" : "Mark prepared"}
            </Button>
            <SettingsRow
              title="Edit recipe & servings"
              detail="Ingredients and nutrition per serving"
              icon="create-outline"
              onPress={() => setSheet("edit")}
            />
            <Copy muted style={{ fontSize: 13 }}>
              Prepared doesn’t mean eaten. Log a portion only after eating it.
            </Copy>
            <Button
              secondary
              disabled={
                saving ||
                state.entries.some(
                  (entry) =>
                    entry.id === `prep-${batch.id}` &&
                    entry.date === localDate() &&
                    entry.status === "confirmed",
                )
              }
              onPress={() =>
                void run(
                  (previous) => logPrepPortion(previous, batch, localDate()),
                  "One serving logged for today. Review it in History.",
                )
              }
            >
              {state.entries.some(
                (entry) =>
                  entry.id === `prep-${batch.id}` &&
                  entry.date === localDate() &&
                  entry.status === "confirmed",
              )
                ? "One serving logged today"
                : "Log one serving today"}
            </Button>
            {message ? <Notice>{message}</Notice> : null}
            <SettingsRow
              title="Remove this batch"
              danger
              icon="trash-outline"
              onPress={() => setRemove(true)}
            />
            {remove ? (
              <>
                <Notice>
                  Remove this planned batch and refresh the grocery checklist?
                  Food already logged stays in your history.
                </Notice>
                <Button
                  busy={saving}
                  onPress={() =>
                    void run((previous) => ({
                      ...previous,
                      mealPrep: {
                        ...(previous.mealPrep ?? emptyPrep()),
                        batches: (previous.mealPrep?.batches ?? []).filter(
                          (item) => item.id !== batch.id,
                        ),
                        checked: [],
                      },
                    })).then((saved) => {
                      if (saved) setSheet(null);
                    })
                  }
                >
                  Remove batch
                </Button>
                <Button secondary onPress={() => setRemove(false)}>
                  Keep batch
                </Button>
              </>
            ) : null}
            {error ? <Notice error>{error}</Notice> : null}
          </>
        ) : null}
      </DetailSheet>
    </MobileFrame>
  );
}
const s = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 4 },
  icon: {
    minWidth: 48,
    minHeight: 48,
    justifyContent: "center",
    alignItems: "center",
  },
  title: { flex: 1, color: c.text, fontSize: 25, fontWeight: "700" },
  week: {
    flex: 1,
    textAlign: "center",
    fontSize: 14,
    fontWeight: "600",
    color: c.text,
  },
  day: {
    flex: 1,
    minHeight: 60,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    borderRadius: 16,
    backgroundColor: "white",
  },
  dayLabel: { color: c.muted, fontSize: 11 },
  dayNumber: { color: c.text, fontSize: 18, fontWeight: "600" },
  overview: {
    backgroundColor: c.accentSoft,
    borderRadius: 20,
    padding: 18,
    gap: 6,
  },
  portions: { color: c.text, fontSize: 27, fontWeight: "700" },
  segments: {
    flexDirection: "row",
    padding: 4,
    borderRadius: 14,
    backgroundColor: c.border,
  },
  segment: {
    flex: 1,
    minHeight: 48,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  empty: { alignItems: "center", paddingVertical: 24, gap: 12 },
  emptyTitle: { fontSize: 21, fontWeight: "600", color: c.text },
  grocery: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    backgroundColor: "white",
    borderRadius: 15,
    minHeight: 60,
  },
});
