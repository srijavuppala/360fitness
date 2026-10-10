import { useState } from "react";
import { Plus, Trash2, Search, Check } from "lucide-react";
import { useStore } from "../lib/store";
import {
  id,
  localDate,
  slots,
  foodLibrary,
  copyMeal,
  scaleFood,
  sumNutrition,
  formatValue,
  logMeal,
  validateMeal,
  type Meal,
  type Food,
  type Slot,
} from "../lib/model";
import { Dialog, Notice } from "./ui";
export function MealEditor({
  initial,
  date = localDate(),
  template = false,
  existing = false,
  onClose,
}: {
  initial?: Meal;
  date?: string;
  template?: boolean;
  existing?: boolean;
  onClose: () => void;
}) {
  const { update, busy } = useStore();
  const [meal, setMeal] = useState<Meal>(() =>
    copyMeal(initial ?? { id: id(), name: "", slot: "Snack", foods: [] }),
  );
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [saveUsual, setSaveUsual] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const total = sumNutrition(meal.foods);
  function foodChange(index: number, fn: (food: Food) => Food) {
    setMeal((prev) => ({
      ...prev,
      foods: prev.foods.map((food, i) => (i === index ? fn(food) : food)),
    }));
  }
  async function save() {
    try {
      validateMeal(meal);
      const ok = await update(
        (prev) => {
          let next = template
            ? {
                ...prev,
                templates: [
                  ...prev.templates.filter((m) => m.id !== meal.id),
                  meal,
                ],
              }
            : logMeal(prev, meal, date);
          if (saveUsual && !template)
            next = {
              ...next,
              templates: [
                ...next.templates.filter((m) => m.id !== meal.id),
                meal,
              ],
            };
          return next;
        },
        template ? "Meal plan saved" : "Meal logged. You’re all set.",
      );
      if (ok) onClose();
    } catch (cause) {
      setError((cause as Error).message);
    }
  }
  async function remove() {
    const ok = await update(
      (prev) =>
        template
          ? {
              ...prev,
              templates: prev.templates.filter((m) => m.id !== meal.id),
            }
          : {
              ...prev,
              entries: prev.entries.filter(
                (m) => !(m.id === meal.id && m.date === date),
              ),
            },
      "Meal removed",
    );
    if (ok) onClose();
  }
  return (
    <Dialog
      title={
        template
          ? "Make it a usual."
          : existing
            ? "Edit your meal."
            : "What’s on your plate?"
      }
      onClose={() => {
        if (!busy) onClose();
      }}
      wide
    >
      <p className="muted">
        {template
          ? "Build a meal you can come back to. Your past logs stay the same."
          : `Review your foods and portions before logging for ${date}. Estimates are not exact measurements.`}
      </p>
      <div className="form-grid">
        <label>
          Meal name
          <input
            autoFocus
            value={meal.name}
            maxLength={100}
            placeholder="e.g. My everyday breakfast"
            onChange={(e) => setMeal({ ...meal, name: e.target.value })}
          />
        </label>
        <label>
          Meal time
          <select
            value={meal.slot}
            onChange={(e) => setMeal({ ...meal, slot: e.target.value as Slot })}
          >
            {slots.map((slot) => (
              <option key={slot}>{slot}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="editor-summary">
        <strong>
          {formatValue(total.kcal)} <small>kcal</small>
        </strong>
        <span>{formatValue(total.protein)}g protein</span>
        <span>{formatValue(total.carbs)}g carbs</span>
        <span>{formatValue(total.fat)}g fat</span>
      </div>
      {meal.foods.map((food, index) => (
        <div className="food-edit" key={food.id}>
          <div className="food-edit-head">
            <label className="grow">
              Food name
              <input
                aria-label={`Food ${index + 1} name`}
                value={food.name}
                maxLength={80}
                onChange={(e) =>
                  foodChange(index, (f) => ({ ...f, name: e.target.value }))
                }
              />
            </label>
            <button
              className="icon-button"
              aria-label={`Remove ${food.name || "food"}`}
              onClick={() =>
                setMeal({
                  ...meal,
                  foods: meal.foods.filter((f) => f.id !== food.id),
                })
              }
            >
              <Trash2 size={17} />
            </button>
          </div>
          <div className="food-fields">
            <label>
              Quantity
              <input
                type="number"
                min="0.01"
                max="10000"
                step="any"
                value={food.quantity || ""}
                onChange={(e) => {
                  const qty = Number(e.target.value);
                  foodChange(index, (f) =>
                    qty > 0 && qty <= 10000 && f.quantity > 0
                      ? scaleFood(f, qty)
                      : { ...f, quantity: qty },
                  );
                }}
              />
            </label>
            <label>
              Unit
              <input
                value={food.unit}
                maxLength={24}
                onChange={(e) =>
                  foodChange(index, (f) => ({ ...f, unit: e.target.value }))
                }
              />
            </label>
            {(["kcal", "protein", "carbs", "fat"] as const).map((key) => (
              <label key={key}>
                {key === "kcal" ? "Calories" : `${key} (g)`}
                <input
                  type="number"
                  min="0"
                  max="10000"
                  step="any"
                  placeholder="Unknown"
                  value={food.nutrition[key] ?? ""}
                  onChange={(e) =>
                    foodChange(index, (f) => ({
                      ...f,
                      nutrition: {
                        ...f.nutrition,
                        [key]:
                          e.target.value === "" ? null : Number(e.target.value),
                      },
                    }))
                  }
                />
              </label>
            ))}
          </div>
          <small className="muted">
            {food.source === "ai"
              ? "Imported AI estimate"
              : food.source === "sample"
                ? "Starter estimate — check against your food label"
                : "Your entered values"}{" "}
            · Nutrition is for the entire quantity.
          </small>
        </div>
      ))}
      <div className="food-picker">
        <label className="search">
          <Search size={18} />
          <input
            aria-label="Search ingredients"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Find a food to add…"
          />
        </label>
        <div className="food-picks">
          {foodLibrary
            .filter((f) => f.name.toLowerCase().includes(search.toLowerCase()))
            .slice(0, 6)
            .map((food) => (
              <button
                key={food.id}
                disabled={meal.foods.length >= 30}
                onClick={() => {
                  setMeal({
                    ...meal,
                    foods: [
                      ...meal.foods,
                      { ...structuredClone(food), id: id() },
                    ],
                  });
                  setSearch("");
                }}
              >
                {food.name}
                <Plus size={14} />
              </button>
            ))}
        </div>
        <button
          className="text-button"
          disabled={meal.foods.length >= 30}
          onClick={() =>
            setMeal({
              ...meal,
              foods: [
                ...meal.foods,
                {
                  id: id(),
                  name: "",
                  quantity: 1,
                  unit: "serving",
                  nutrition: {
                    kcal: null,
                    protein: null,
                    carbs: null,
                    fat: null,
                  },
                  source: "manual",
                },
              ],
            })
          }
        >
          <Plus size={15} />
          Add a custom food
        </button>
      </div>
      {!template && !existing && (
        <label className="check">
          <input
            type="checkbox"
            checked={saveUsual}
            onChange={(e) => setSaveUsual(e.target.checked)}
          />
          Save this as a usual meal, too
        </label>
      )}
      {error && <Notice error>{error}</Notice>}
      <div className="modal-footer">
        {existing && (
          <button
            className="text-button danger"
            disabled={busy}
            onClick={() => setDeleting(true)}
          >
            <Trash2 size={15} />
            Delete meal
          </button>
        )}
        <button className="button secondary" disabled={busy} onClick={onClose}>
          Cancel
        </button>
        <button
          className="button"
          disabled={busy || !meal.foods.length}
          onClick={save}
        >
          <Check size={17} />
          {busy ? "Saving…" : template ? "Save usual meal" : "Confirm meal"}
        </button>
      </div>
      {deleting && (
        <Notice>
          <p>
            This removes{" "}
            {template
              ? "the usual meal; past logs are kept"
              : "this logged meal"}
            . This cannot be undone.
          </p>
          <button
            className="button danger-button"
            disabled={busy}
            onClick={remove}
          >
            Yes, delete meal
          </button>{" "}
          <button className="text-button" onClick={() => setDeleting(false)}>
            Keep it
          </button>
        </Notice>
      )}
    </Dialog>
  );
}
