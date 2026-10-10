import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { Button, Copy, Field, Icon, Notice } from "./ui";
import { SettingsRow } from "./MobileFrame";
import { FoodForm } from "./FoodForm";
import { VoiceTextField } from "./VoiceTextField";
import { PrepRecipeLibrary } from "./PrepRecipeLibrary";
import { batchFromRecipe } from "../domain/prep-recipes";
import { useApp } from "../data/store";
import { Food, Meal, newId, slots, sumNutrition } from "../domain/meals";
import { makeBatch, PrepBatch, saveBatch } from "../domain/meal-prep";
import { analysePrep, prepAiAvailable } from "../services/prep-ai";
import { colors as c } from "../theme";

export function ServingStepper({
  value,
  onChange,
  disabled = false,
}: {
  value: number;
  onChange(n: number): void;
  disabled?: boolean;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
      }}
    >
      <Copy>Batch servings</Copy>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 18 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Fewer servings"
          disabled={disabled || value <= 1}
          onPress={() => onChange(value - 1)}
          style={{
            width: 48,
            height: 48,
            borderRadius: 24,
            backgroundColor: c.accentSoft,
            alignItems: "center",
            justifyContent: "center",
            opacity: value <= 1 ? 0.4 : 1,
          }}
        >
          <Icon name="remove" />
        </Pressable>
        <Text
          accessibilityLiveRegion="polite"
          style={{ fontSize: 22, fontWeight: "600", color: c.text }}
        >
          {value}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="More servings"
          disabled={disabled || value >= 20}
          onPress={() => onChange(value + 1)}
          style={{
            width: 48,
            height: 48,
            borderRadius: 24,
            backgroundColor: c.accentSoft,
            alignItems: "center",
            justifyContent: "center",
            opacity: value >= 20 ? 0.4 : 1,
          }}
        >
          <Icon name="add" />
        </Pressable>
      </View>
    </View>
  );
}
export function PrepComposer({
  date,
  initial,
  onDone,
}: {
  date: string;
  initial?: PrepBatch;
  onDone(): void;
}) {
  const { state, update, saving } = useApp();
  const [stage, setStage] = useState<
    "choose" | "starters" | "usual" | "describe" | "options" | "review"
  >(initial ? "review" : "choose");
  const [draft, setDraft] = useState<PrepBatch | null>(initial ?? null);
  const [servings, setServings] = useState(initial?.servings ?? 4);
  const [description, setDescription] = useState("");
  const [usePreferences, setUsePreferences] = useState(false);
  const [editingFood, setEditingFood] = useState<Food | "new" | null>(null);
  const [reviewed, setReviewed] = useState(false);
  const [panel, setPanel] = useState<"overview" | "ingredients" | "notes">(
    "overview",
  );
  const [ingredientPage, setIngredientPage] = useState(0);
  const [usualPage, setUsualPage] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null);
  const working = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      controller.current?.abort();
    };
  }, []);
  useFocusEffect(useCallback(() => () => controller.current?.abort(), []));
  const profile = state.profile?.answers;
  const preferenceSummary = profile
    ? ["diet", "dietOther", "allergies", "allergyOther", "avoidedFoods"]
        .map((key) => {
          const answer = profile[key as keyof typeof profile];
          return answer
            ? `${key}: ${Array.isArray(answer) ? answer.join(", ") : answer}`
            : "";
        })
        .filter(Boolean)
        .join("; ")
        .slice(0, 1200)
    : "";
  function choose(meal: Meal) {
    try {
      setDraft(makeBatch(meal, date, servings));
      setReviewed(false);
      setStage("review");
      setError("");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "This meal can’t be used for prep.",
      );
    }
  }
  async function analyse() {
    if (working.current) return;
    if (description.trim().length < 5) {
      setError("Describe what you want to prep first.");
      return;
    }
    working.current = true;
    setBusy(true);
    setError("");
    controller.current = new AbortController();
    try {
      const suggestion = await analysePrep(
        {
          description,
          servings,
          ...(usePreferences ? { preferences: preferenceSummary } : {}),
        },
        controller.current.signal,
      );
      if (!mounted.current || controller.current.signal.aborted) return;
      setDraft(makeBatch(suggestion.meal, date, servings, suggestion.note));
      setReviewed(false);
      setStage("review");
    } catch (cause) {
      if (mounted.current)
        setError(
          cause instanceof Error ? cause.message : "Recipe analysis failed.",
        );
    } finally {
      working.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  async function save() {
    if (
      !draft ||
      working.current ||
      (draft.meal.foods.some((food) => food.source === "ai") && !reviewed)
    )
      return;
    working.current = true;
    setError("");
    try {
      await update((previous) => saveBatch(previous, draft));
      onDone();
    } catch (cause) {
      if (mounted.current)
        setError(
          cause instanceof Error
            ? cause.message
            : "Couldn’t save this prep batch.",
        );
    } finally {
      working.current = false;
    }
  }
  if (editingFood && draft)
    return (
      <FoodForm
        key={typeof editingFood === "string" ? "new" : editingFood.id}
        initial={editingFood === "new" ? undefined : editingFood}
        onCancel={() => setEditingFood(null)}
        onAdd={(food) => {
          setDraft({
            ...draft,
            prepared: false,
            guide: undefined,
            meal: {
              ...draft.meal,
              foods:
                editingFood === "new"
                  ? [...draft.meal.foods, food]
                  : draft.meal.foods.map((item) =>
                      item.id === food.id ? food : item,
                    ),
            },
          });
          setReviewed(false);
          setEditingFood(null);
        }}
      />
    );
  if (draft && panel === "notes")
    return (
      <>
        <Copy>{draft.note}</Copy>
        <Button secondary onPress={() => setPanel("overview")}>
          Back to recipe
        </Button>
      </>
    );
  if (draft && panel === "ingredients") {
    const pages = Math.max(1, Math.ceil(draft.meal.foods.length / 4));
    const page = Math.min(ingredientPage, pages - 1);
    return (
      <>
        <Copy muted style={{ fontSize: 13 }}>
          Amounts are for ONE serving. Your grocery list multiplies them by{" "}
          {draft.servings}. Tap an ingredient to review nutrition.
          {draft.guide
            ? " Editing ingredients removes the original prep guide."
            : ""}
        </Copy>
        {draft.meal.foods.slice(page * 4, page * 4 + 4).map((food) => (
          <View
            key={food.id}
            style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
          >
            <View style={{ flex: 1 }}>
              <SettingsRow
                title={food.name}
                detail={`${Number(food.quantity.toFixed(3))} ${food.unit} per serving`}
                onPress={() => setEditingFood(food)}
              />
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Remove ${food.name}`}
              onPress={() => {
                setDraft({
                  ...draft,
                  prepared: false,
                  guide: undefined,
                  meal: {
                    ...draft.meal,
                    foods: draft.meal.foods.filter(
                      (item) => item.id !== food.id,
                    ),
                  },
                });
                setReviewed(false);
              }}
              style={{
                minWidth: 48,
                minHeight: 48,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon name="close" color={c.muted} />
            </Pressable>
          </View>
        ))}
        <Button
          secondary
          disabled={draft.meal.foods.length >= 12}
          onPress={() => setEditingFood("new")}
        >
          Add ingredient
        </Button>

        {pages > 1 ? (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Previous ingredients"
              disabled={page === 0}
              onPress={() => setIngredientPage(page - 1)}
              style={{
                minWidth: 48,
                minHeight: 48,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Icon name="chevron-back" />
            </Pressable>
            <Copy muted>
              {page + 1} of {pages}
            </Copy>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Next ingredients"
              disabled={page === pages - 1}
              onPress={() => setIngredientPage(page + 1)}
              style={{
                minWidth: 48,
                minHeight: 48,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Icon name="chevron-forward" />
            </Pressable>
          </View>
        ) : null}
        <Button secondary onPress={() => setPanel("overview")}>
          Back to recipe
        </Button>
      </>
    );
  }
  if (stage === "starters")
    return (
      <PrepRecipeLibrary
        onBack={() => setStage("choose")}
        onChoose={(recipe) => {
          setDraft(batchFromRecipe(recipe, date, servings));
          setReviewed(false);
          setStage("review");
          setError("");
        }}
      />
    );
  if (stage === "usual") {
    const pages = Math.max(1, Math.ceil(state.templates.length / 3));
    const page = Math.min(usualPage, pages - 1);
    return (
      <>
        <Copy>Start with a meal you already know.</Copy>
        {state.templates.slice(page * 3, page * 3 + 3).map((meal) => (
          <SettingsRow
            key={meal.id}
            title={meal.name}
            detail={meal.slot}
            onPress={() => choose(meal)}
          />
        ))}
        {!state.templates.length ? (
          <Copy muted>No usual meals yet. Try a starter recipe.</Copy>
        ) : null}
        {pages > 1 ? (
          <View style={{ flexDirection: "row", gap: 8 }}>
            <View style={{ flex: 1 }}>
              <Button
                secondary
                disabled={page === 0}
                onPress={() => setUsualPage(page - 1)}
              >
                Previous
              </Button>
            </View>
            <View style={{ flex: 1 }}>
              <Button
                secondary
                disabled={page === pages - 1}
                onPress={() => setUsualPage(page + 1)}
              >
                Next
              </Button>
            </View>
          </View>
        ) : null}
        <Button secondary onPress={() => setStage("choose")}>
          Back to recipe choices
        </Button>
        {error ? <Notice error>{error}</Notice> : null}
      </>
    );
  }
  return (
    <>
      {stage === "choose" ? (
        <>
          <Copy muted>
            Choose a recipe for {date}. Each saved meal represents one serving.
          </Copy>
          <SettingsRow
            title="Browse starter recipes"
            detail="Six simple ideas · guided prep · works offline"
            icon="book-outline"
            onPress={() => setStage("starters")}
          />
          <SettingsRow
            title="Use a usual meal"
            detail="Turn a saved meal into a prep batch"
            icon="heart-outline"
            onPress={() => setStage("usual")}
          />
          <SettingsRow
            title="Describe a recipe with Gemini"
            detail="Get an editable ingredient estimate"
            icon="sparkles-outline"
            onPress={() => setStage("describe")}
          />
          <SettingsRow
            title="Create a recipe manually"
            icon="create-outline"
            onPress={() => {
              setDraft({
                id: newId(),
                date,
                servings,
                prepared: false,
                note: "",
                meal: { id: newId(), name: "", slot: "Lunch", foods: [] },
              });
              setStage("review");
            }}
          />
        </>
      ) : stage === "describe" ? (
        <>
          <Copy>What would you like to prep?</Copy>
          <VoiceTextField
            compact
            label="Recipe description"
            value={description}
            onChange={setDescription}
            maxLength={3000}
            disabled={busy}
          />
          <Copy muted style={{ fontSize: 12 }}>
            Example: chickpea rice bowls with broccoli. If you enter ingredient
            quantities, use the whole batch.
          </Copy>
          <Button
            disabled={description.trim().length < 5}
            onPress={() => setStage("options")}
          >
            Choose servings
          </Button>
          <Button secondary onPress={() => setStage("choose")}>
            Back to recipe choices
          </Button>
        </>
      ) : stage === "options" ? (
        <>
          <Copy>Set up your recipe estimate</Copy>
          <ServingStepper
            value={servings}
            onChange={setServings}
            disabled={busy}
          />
          {preferenceSummary ? (
            <Pressable
              accessibilityRole="checkbox"
              aria-checked={usePreferences}
              accessibilityState={{ checked: usePreferences }}
              disabled={busy}
              onPress={() => setUsePreferences(!usePreferences)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                minHeight: 48,
              }}
            >
              <Icon
                name={usePreferences ? "checkbox" : "square-outline"}
                color={c.accent}
              />
              <Text style={{ flex: 1, color: c.text, fontSize: 14 }}>
                Include my diet preferences and allergies
              </Text>
            </Pressable>
          ) : null}
          <Copy muted style={{ fontSize: 12 }}>
            Analyse sends this description
            {usePreferences ? " and the selected food preferences" : ""} to
            Gemini. Review ingredients and estimates before saving.
          </Copy>
          {!prepAiAvailable ? (
            <Notice>
              Recipe AI needs a configured phone build. You can create a recipe
              manually or use a saved meal.
            </Notice>
          ) : null}
          <Button
            icon="sparkles-outline"
            busy={busy}
            disabled={!prepAiAvailable}
            onPress={() => void analyse()}
          >
            Analyse recipe with Gemini
          </Button>
          {busy ? (
            <Button secondary onPress={() => controller.current?.abort()}>
              Cancel analysis
            </Button>
          ) : (
            <Button secondary onPress={() => setStage("choose")}>
              Choose a saved meal instead
            </Button>
          )}
        </>
      ) : draft ? (
        <>
          <View>
            <Field
              label="Recipe name"
              value={draft.meal.name}
              maxLength={100}
              onChangeText={(name) =>
                setDraft({ ...draft, meal: { ...draft.meal, name } })
              }
            />
          </View>
          <ServingStepper
            value={draft.servings}
            onChange={(value) =>
              setDraft({
                ...draft,
                servings: value,
                prepared: false,
                ...(draft.guide
                  ? { guide: { ...draft.guide, completed: 0 } }
                  : {}),
              })
            }
          />
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {slots.map((slot) => (
              <Pressable
                key={slot}
                accessibilityRole="radio"
                aria-checked={draft.meal.slot === slot}
                accessibilityLabel={`Meal time: ${slot}`}
                onPress={() =>
                  setDraft({ ...draft, meal: { ...draft.meal, slot } })
                }
                style={{
                  padding: 12,
                  minHeight: 48,
                  borderRadius: 12,
                  backgroundColor:
                    draft.meal.slot === slot ? c.accentSoft : "white",
                }}
              >
                <Text style={{ color: c.text, fontSize: 13 }}>{slot}</Text>
              </Pressable>
            ))}
          </View>
          <SettingsRow
            title={`Ingredients · ${draft.meal.foods.length}`}
            detail="Review amounts and nutrition per serving"
            icon="list-outline"
            onPress={() => {
              setIngredientPage(0);
              setPanel("ingredients");
            }}
          />
          <Copy muted style={{ fontSize: 13 }}>
            Per serving:{" "}
            {sumNutrition(draft.meal.foods).kcal === null
              ? "Unknown"
              : Math.round(sumNutrition(draft.meal.foods).kcal!)}{" "}
            kcal ·{" "}
            {sumNutrition(draft.meal.foods).protein === null
              ? "Unknown"
              : Math.round(sumNutrition(draft.meal.foods).protein!)}{" "}
            g protein
          </Copy>
          {draft.note ? (
            <SettingsRow
              title="Recipe notes & assumptions"
              icon="information-circle-outline"
              onPress={() => setPanel("notes")}
            />
          ) : null}
          {draft.meal.foods.some((food) => food.source === "ai") ? (
            <Pressable
              accessibilityRole="checkbox"
              aria-checked={reviewed}
              accessibilityState={{ checked: reviewed }}
              onPress={() => setReviewed(!reviewed)}
              style={{
                minHeight: 48,
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
              }}
            >
              <Icon
                name={reviewed ? "checkbox" : "square-outline"}
                color={c.accent}
              />
              <Text style={{ flex: 1, color: c.text, fontSize: 14 }}>
                I reviewed ingredients, portions and estimated nutrition. This
                does not confirm allergy safety.
              </Text>
            </Pressable>
          ) : null}
          <Button
            busy={saving}
            disabled={
              !draft.meal.foods.length ||
              !draft.meal.name.trim() ||
              (draft.meal.foods.some((food) => food.source === "ai") &&
                !reviewed)
            }
            onPress={() => void save()}
          >
            Save prep batch
          </Button>
          <Copy muted style={{ fontSize: 12 }}>
            Prep day: {draft.date}. Saving plans the batch; it does not log food
            as eaten.
          </Copy>
        </>
      ) : null}
      {error ? <Notice error>{error}</Notice> : null}
    </>
  );
}
