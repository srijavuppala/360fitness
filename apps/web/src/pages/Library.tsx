import { useMemo, useState } from "react";
import { Search, Plus, ArrowUpRight } from "lucide-react";
import { useStore } from "../lib/store";
import {
  foodLibrary,
  formatValue,
  id,
  type Meal,
  type Food,
} from "../lib/model";
import { PageHeading, Empty, Notice } from "../components/ui";
import { MealEditor } from "../components/MealEditor";
export default function Library() {
  const { state } = useStore();
  const [query, setQuery] = useState(""),
    [category, setCategory] = useState("All foods"),
    [editor, setEditor] = useState<Meal | undefined | null>(null);
  const foods = useMemo(() => {
    const map = new Map<string, Food>();
    for (const food of [
      ...foodLibrary,
      ...state.templates.flatMap((m) => m.foods),
      ...state.entries.flatMap((m) => m.foods),
    ])
      map.set(food.name.toLowerCase(), food);
    return [...map.values()];
  }, [state.templates, state.entries]);
  const filtered = foods.filter(
    (f) =>
      f.name.toLowerCase().includes(query.toLowerCase()) &&
      (category === "All foods" ||
        (category === "My foods" && f.source === "manual") ||
        (category === "Protein sources" && (f.nutrition.protein ?? 0) >= 10)),
  );
  return (
    <>
      <PageHeading
        eyebrow="GET TO KNOW YOUR FOOD"
        title="Good food. Less guesswork."
        subtitle="Find a starting point, check the portion, and make it your own."
        action={
          <button
            className="button secondary"
            onClick={() => setEditor(undefined)}
          >
            <Plus size={17} />
            Custom meal
          </button>
        }
      />
      <label className="search library-search">
        <Search size={20} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search foods, ingredients, and your saved favorites…"
          aria-label="Search food library"
        />
      </label>
      <div className="filters">
        {["All foods", "Protein sources", "My foods"].map((c) => (
          <button
            className={category === c ? "active" : ""}
            key={c}
            onClick={() => setCategory(c)}
          >
            {c}
          </button>
        ))}
      </div>
      <Notice>
        Starter values are illustrative estimates, not a verified food database.
        For precise tracking, use the nutrition label and edit values before
        confirming.
      </Notice>
      <div className="panel food-table-wrap">
        <table className="food-table">
          <thead>
            <tr>
              <th>Food & serving</th>
              <th>Calories</th>
              <th>Protein</th>
              <th>Carbs</th>
              <th>Fat</th>
              <th>
                <span className="sr-only">Action</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((food) => (
              <tr key={food.name}>
                <td>
                  <strong>{food.name}</strong>
                  <small>
                    {food.quantity} {food.unit} ·{" "}
                    {food.source === "sample"
                      ? "Starter estimate"
                      : food.source === "ai"
                        ? "AI estimate"
                        : food.source === "barcode"
                          ? "Open Food Facts"
                          : "Your food"}
                  </small>
                </td>
                {(["kcal", "protein", "carbs", "fat"] as const).map((key) => (
                  <td key={key}>
                    {formatValue(food.nutrition[key])}
                    {key === "kcal" ? "" : "g"}
                  </td>
                ))}
                <td>
                  <button
                    className="icon-button"
                    aria-label={`Log ${food.name}`}
                    onClick={() =>
                      setEditor({
                        id: id(),
                        name: food.name,
                        slot: "Snack",
                        foods: [{ ...structuredClone(food), id: id() }],
                      })
                    }
                  >
                    <ArrowUpRight size={19} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!filtered.length && (
          <Empty title="No foods found.">
            Try another name or add your own food in a custom meal.
          </Empty>
        )}
      </div>
      {editor !== null && (
        <MealEditor initial={editor} onClose={() => setEditor(null)} />
      )}
    </>
  );
}
