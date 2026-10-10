import { useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Redirect, router, useLocalSearchParams } from "expo-router";
import {
  Button,
  Card,
  Copy,
  DemoBanner,
  Field,
  Header,
  Icon,
  Notice,
  Nutrition,
  Screen,
  Section,
  styles,
} from "../components/ui";
import { FoodForm } from "../components/FoodForm";
import { useApp } from "../data/store";
import {
  copyMeal,
  Food,
  formatValue,
  localDate,
  Meal,
  newId,
  recordMeal,
  scaleFood,
  slots,
  sumNutrition,
  validateMeal,
} from "../domain/meals";
import { colors as c } from "../theme";

export default function MealRoute() {
  const params = useLocalSearchParams<{
    id?: string;
    draft?: string;
    mode?: string;
    date?: string;
  }>();
  const { ready, state, pendingMeal } = useApp();
  if (!ready) return <Redirect href="/" />;
  const date = params.date ?? localDate();
  const template = params.mode === "template";
  const found = params.draft
    ? pendingMeal?.id === params.draft
      ? pendingMeal
      : undefined
    : ((template
        ? undefined
        : state.entries.find(
            (entry) => entry.id === params.id && entry.date === date,
          )) ?? state.templates.find((meal) => meal.id === params.id));
  if ((params.id || params.draft) && !found)
    return (
      <Screen>
        <Header back title="Meal unavailable" />
        <Copy muted>
          This meal or unsaved estimate is no longer available. Please open it
          again.
        </Copy>
      </Screen>
    );
  return (
    <MealEditor
      key={`${params.draft ?? params.id ?? "new"}-${params.mode ?? "log"}-${date}`}
      original={found}
      usual={state.templates.find((meal) => meal.id === params.id)}
      imported={!!params.draft}
      template={template}
      date={date}
    />
  );
}

function MealEditor({
  original,
  imported = false,
  usual,
  template,
  date,
}: {
  original?: Meal;
  imported?: boolean;
  usual?: Meal;
  template: boolean;
  date: string;
}) {
  const { update, saving } = useApp();
  const [draft, setDraft] = useState<Meal>(() =>
    copyMeal(original ?? { id: newId(), name: "", slot: "Snack", foods: [] }),
  );
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [adding, setAdding] = useState(!original);
  const [editing, setEditing] = useState<Food | null>(null);
  const [removed, setRemoved] = useState<{ food: Food; index: number } | null>(
    null,
  );
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const locked = useRef(false);
  const foods = draft.foods.map((food) => {
    const quantity =
      quantities[food.id] === undefined
        ? food.quantity
        : Number(quantities[food.id]);
    return Number.isFinite(quantity) && quantity > 0 && quantity <= 10000
      ? scaleFood(food, quantity)
      : { ...food, quantity: NaN };
  });
  const total = sumNutrition(foods);
  async function save(status: "confirmed" | "skipped" = "confirmed") {
    if (locked.current) return;
    locked.current = true;
    setError("");
    try {
      const meal = { ...draft, name: draft.name.trim(), foods };
      validateMeal(meal);
      await update((previous) =>
        template
          ? {
              ...previous,
              templates: previous.templates.some((item) => item.id === meal.id)
                ? previous.templates.map((item) =>
                    item.id === meal.id ? meal : item,
                  )
                : [...previous.templates, meal],
            }
          : recordMeal(previous, meal, date, status),
      );
      if (template) {
        if (router.canGoBack()) router.back();
        else router.replace("/");
      } else router.replace({ pathname: "/saved", params: { status, date } });
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Couldn’t save. Please try again.",
      );
    } finally {
      locked.current = false;
    }
  }
  async function removeTemplate() {
    try {
      await update((previous) => ({
        ...previous,
        templates: previous.templates.filter((meal) => meal.id !== draft.id),
      }));
      router.back();
    } catch {
      setError("Couldn’t remove this meal. Please try again.");
    }
  }
  return (
    <Screen
      footer={
        <Button
          busy={saving}
          disabled={adding || !!editing}
          onPress={() => save()}
          icon="checkmark"
        >
          {template ? "Save usual meal" : "Confirm meal"}
        </Button>
      }
    >
      <DemoBanner />
      <Header
        back
        eyebrow={
          template ? "Your plan / Make it yours" : `Daily check-in / ${date}`
        }
        title={
          template
            ? original
              ? "Edit your usual."
              : "A new usual."
            : original
              ? "How was your meal?"
              : "Something different."
        }
        subtitle={
          template
            ? "Changes apply to your plan. Past meals stay the same."
            : "Review what you actually ate. Your usual plan stays the same."
        }
      />
      {imported ? (
        <Notice>
          This meal draft has not been logged. Check every food and portion,
          edit any values, then confirm. Unsaved drafts are cleared when the app
          restarts.
        </Notice>
      ) : null}
      <Field
        label="Meal name"
        value={draft.name}
        onChangeText={(name) => setDraft((previous) => ({ ...previous, name }))}
        maxLength={100}
        placeholder="Give your meal a name"
      />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {slots.map((slot) => (
          <Pressable
            key={slot}
            onPress={() => setDraft((previous) => ({ ...previous, slot }))}
            accessibilityRole="radio"
            aria-checked={draft.slot === slot}
            style={{
              paddingVertical: 13,
              paddingHorizontal: 14,
              borderRadius: 30,
              borderWidth: 1,
              borderColor: draft.slot === slot ? c.accent : c.border,
              backgroundColor: draft.slot === slot ? c.accentSoft : c.surface,
            }}
          >
            <Text
              style={{
                color: draft.slot === slot ? c.accent : c.muted,
                fontSize: 12,
              }}
            >
              {slot}
            </Text>
          </Pressable>
        ))}
      </View>
      <Card>
        <Text style={{ color: c.accent, fontSize: 30, fontWeight: "600" }}>
          {formatValue(total.kcal)}
          <Text style={{ fontSize: 14 }}> kcal</Text>
        </Text>
        <Copy muted style={{ fontSize: 12 }}>
          Estimated nutrition ·{" "}
          {foods.some((food) => food.source === "sample")
            ? "Includes illustrative sample values"
            : foods.some((food) => food.source === "ai")
              ? "Includes AI-assisted estimates"
              : foods.some((food) => food.source === "barcode")
                ? "Open Food Facts contributors · check package label"
                : "Manually entered values"}
        </Copy>
        <Nutrition total={total} />
      </Card>
      <Section
        title="What’s on your plate?"
        detail={`${foods.length} ${foods.length === 1 ? "food" : "foods"}`}
      />
      {original && !template ? (
        <View style={styles.row}>
          {[0.5, 1, 1.5].map((factor) => (
            <Pressable
              key={factor}
              accessibilityRole="button"
              disabled={adding || !!editing}
              accessibilityState={{ disabled: adding || !!editing }}
              onPress={() =>
                setQuantities(
                  Object.fromEntries(
                    draft.foods.map((food) => [
                      food.id,
                      String(
                        (usual?.foods.find((item) => item.id === food.id)
                          ?.quantity ?? food.quantity) * factor,
                      ),
                    ]),
                  ),
                )
              }
              style={{
                flex: 1,
                backgroundColor: c.elevated,
                paddingVertical: 14,
                borderRadius: 12,
                alignItems: "center",
              }}
            >
              <Copy style={{ fontSize: 12 }}>
                {factor === 1
                  ? usual
                    ? "Usual portion"
                    : imported
                      ? "Estimated portion"
                      : "Saved portion"
                  : `${factor}× portion`}
              </Copy>
            </Pressable>
          ))}
        </View>
      ) : null}
      {draft.foods.map((food, index) =>
        editing?.id === food.id ? (
          <FoodForm
            key={food.id}
            initial={editing}
            onCancel={() => setEditing(null)}
            onAdd={(updated) => {
              setDraft((previous) => ({
                ...previous,
                foods: previous.foods.map((item) =>
                  item.id === updated.id ? updated : item,
                ),
              }));
              setQuantities((previous) => {
                const next = { ...previous };
                delete next[updated.id];
                return next;
              });
              setEditing(null);
            }}
          />
        ) : (
          <Card key={food.id}>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Copy>{food.name}</Copy>
                <Copy muted style={{ fontSize: 11 }}>
                  {food.source === "sample"
                    ? "Sample estimate"
                    : food.source === "ai"
                      ? "AI-assisted estimate"
                      : food.source === "barcode"
                        ? `Open Food Facts · ${food.sourceBarcode ?? "barcode"}`
                        : "Manual entry"}{" "}
                  · {formatValue(foods[index].nutrition.kcal)} kcal
                </Copy>
              </View>
              <Pressable
                onPress={() => {
                  setRemoved({ food, index });
                  setDraft((previous) => ({
                    ...previous,
                    foods: previous.foods.filter((item) => item.id !== food.id),
                  }));
                }}
                accessibilityRole="button"
                disabled={!!editing || adding}
                accessibilityLabel={`Remove ${food.name}`}
                style={{ padding: 12 }}
              >
                <Icon name="close" color={c.muted} size={19} />
              </Pressable>
            </View>
            {food.estimateNote ? (
              <Copy muted style={{ fontSize: 12 }}>
                {food.estimateNote}
              </Copy>
            ) : null}
            <View style={styles.row}>
              <Field
                label={`${food.name} quantity (${food.unit})`}
                value={quantities[food.id] ?? String(food.quantity)}
                onChangeText={(quantity) =>
                  setQuantities((previous) => ({
                    ...previous,
                    [food.id]: quantity,
                  }))
                }
                keyboardType="decimal-pad"
              />
              <Copy muted>{food.unit}</Copy>
            </View>
            <Button
              secondary
              disabled={!!editing || adding}
              accessibilityLabel={`Edit ${food.name}`}
              onPress={() => setEditing(foods[index])}
            >
              Edit food
            </Button>
          </Card>
        ),
      )}
      {removed ? (
        <Button
          secondary
          onPress={() => {
            setDraft((previous) => {
              const next = [...previous.foods];
              next.splice(removed.index, 0, removed.food);
              return { ...previous, foods: next };
            });
            setRemoved(null);
          }}
        >
          Undo removal of {removed.food.name}
        </Button>
      ) : null}
      {adding ? (
        <FoodForm
          onAdd={(food) => {
            setDraft((previous) => ({
              ...previous,
              foods: [...previous.foods, food],
            }));
            setAdding(false);
          }}
          onCancel={() => setAdding(false)}
        />
      ) : (
        <Button
          secondary
          disabled={!!editing}
          icon="add"
          onPress={() => setAdding(true)}
        >
          Add another food
        </Button>
      )}
      {total.kcal === null ||
      total.protein === null ||
      total.carbs === null ||
      total.fat === null ? (
        <Notice>
          A dash means nutrition is unknown, not zero. You can save this as an
          incomplete estimate.
        </Notice>
      ) : null}
      {error ? <Notice error>{error}</Notice> : null}
      {!template && original && !imported ? (
        <Button
          secondary
          disabled={adding || !!editing}
          busy={saving}
          onPress={() => save("skipped")}
        >
          Skipped this meal
        </Button>
      ) : null}
      {template && original && !imported ? (
        confirmDelete ? (
          <>
            <Notice>
              Remove this usual meal? Already logged meals will remain in
              History.
            </Notice>
            <Button secondary busy={saving} onPress={removeTemplate}>
              Yes, remove from my plan
            </Button>
            <Button secondary onPress={() => setConfirmDelete(false)}>
              Keep this meal
            </Button>
          </>
        ) : (
          <Button secondary onPress={() => setConfirmDelete(true)}>
            Remove from my plan
          </Button>
        )
      ) : null}
    </Screen>
  );
}
