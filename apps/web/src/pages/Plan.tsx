import { useState } from "react";
import { Plus, BookOpen } from "lucide-react";
import { useStore } from "../lib/store";
import { starterMeals, id, type Meal } from "../lib/model";
import { PageHeading, MealTile, Empty } from "../components/ui";
import { MealEditor } from "../components/MealEditor";
export default function Plan() {
  const { state } = useStore();
  const [editor, setEditor] = useState<{
    meal?: Meal;
    existing?: boolean;
    template: boolean;
  } | null>(null);
  return (
    <>
      <PageHeading
        eyebrow="YOUR USUAL, MADE SIMPLE"
        title="A routine that feels like you."
        subtitle="Save a few meals you love. Review portions each time you log them."
        action={
          <button
            className="button"
            onClick={() => setEditor({ template: true })}
          >
            <Plus size={17} />
            Create a meal
          </button>
        }
      />
      {state.templates.length ? (
        <div className="meal-grid">
          {state.templates.map((meal) => (
            <div key={meal.id}>
              <MealTile
                meal={meal}
                action="Log this meal"
                onClick={() => setEditor({ meal, template: false })}
              />
              <button
                className="text-button edit-plan"
                onClick={() =>
                  setEditor({ meal, existing: true, template: true })
                }
              >
                Edit usual meal
              </button>
            </div>
          ))}
        </div>
      ) : (
        <section className="panel">
          <Empty
            title="Your go-to meals belong here."
            action={
              <button
                className="button secondary"
                onClick={() => setEditor({ template: true })}
              >
                <BookOpen size={17} />
                Create your first usual
              </button>
            }
          >
            A saved plan never counts as eaten. You decide when to log it.
          </Empty>
        </section>
      )}
      <div className="section-top spaced">
        <div>
          <span className="eyebrow">START SOMEWHERE GOOD</span>
          <h2>A few ideas to make your own</h2>
        </div>
      </div>
      <p className="muted">
        Starter estimates, not a prescribed meal plan. Adjust ingredients and
        nutrition to match your food.
      </p>
      <div className="meal-grid">
        {starterMeals.map((meal) => (
          <MealTile
            key={meal.id}
            meal={meal}
            action="Customize & save"
            onClick={() =>
              setEditor({
                meal: { ...structuredClone(meal), id: id() },
                template: true,
              })
            }
          />
        ))}
      </div>
      {editor && (
        <MealEditor
          initial={editor.meal}
          template={editor.template}
          existing={editor.existing}
          onClose={() => setEditor(null)}
        />
      )}
    </>
  );
}
