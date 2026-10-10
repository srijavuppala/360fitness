import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  ArrowUpRight,
} from "lucide-react";
import { useStore } from "../lib/store";
import {
  localDate,
  validDate,
  slots,
  dailyNutrition,
  sumNutrition,
  formatValue,
  id,
  type Meal,
  type Slot,
} from "../lib/model";
import { PageHeading, SlotIcon, Empty } from "../components/ui";
import { MealEditor } from "../components/MealEditor";
import { Analysis } from "../components/Analysis";
export default function Diary() {
  const { state } = useStore();
  const [params, setParams] = useSearchParams();
  const date = validDate(params.get("date"))
    ? params.get("date")!
    : localDate();
  const [editor, setEditor] = useState<{
      meal?: Meal;
      existing?: boolean;
    } | null>(() => (params.get("add") ? {} : null)),
    [analysis, setAnalysis] = useState(false);
  const activeEditor = editor ?? (params.has("add") ? {} : null);
  const entries = state.entries.filter((e) => e.date === date);
  const total = dailyNutrition(state.entries, date);
  function changeDay(offset: number) {
    const next = new Date(`${date}T12:00:00`);
    next.setDate(next.getDate() + offset);
    setParams({ date: localDate(next) });
  }
  function add(slot: Slot) {
    setEditor({ meal: { id: id(), name: "", slot, foods: [] } });
  }
  return (
    <>
      <PageHeading
        eyebrow="YOUR FOOD DIARY"
        title="Make room for real life."
        subtitle="Log what you ate. Adjust as you go. Your usual plan stays separate."
        action={
          <button className="button" onClick={() => setEditor({})}>
            <Plus size={17} />
            Log a meal
          </button>
        }
      />
      <div className="diary-toolbar">
        <div className="date-picker">
          <button aria-label="Previous day" onClick={() => changeDay(-1)}>
            <ChevronLeft size={18} />
          </button>
          <input
            type="date"
            aria-label="Diary date"
            value={date}
            max={localDate()}
            onChange={(e) => {
              if (validDate(e.target.value))
                setParams({ date: e.target.value });
            }}
          />
          <button
            aria-label="Next day"
            disabled={date >= localDate()}
            onClick={() => changeDay(1)}
          >
            <ChevronRight size={18} />
          </button>
        </div>
        <button className="text-button" onClick={() => setAnalysis(true)}>
          <Sparkles size={16} />
          Describe or import a meal
        </button>
      </div>
      <div className="stat-strip">
        {(["kcal", "protein", "carbs", "fat"] as const).map((key) => (
          <div key={key}>
            <span>{key === "kcal" ? "Calories logged" : key}</span>
            <strong>
              {entries.some((e) => e.status === "confirmed")
                ? formatValue(total[key])
                : "—"}
              <small>{key === "kcal" ? " kcal" : " g"}</small>
            </strong>
          </div>
        ))}
      </div>
      <div className="diary-slots">
        {slots.map((slot) => {
          const rows = entries.filter((e) => e.slot === slot);
          return (
            <section className="panel diary-slot" key={slot}>
              <div className="section-top">
                <div className="slot-heading">
                  <span className={`slot-icon ${slot.toLowerCase()}`}>
                    <SlotIcon slot={slot} />
                  </span>
                  <h2>{slot}</h2>
                </div>
                <button className="text-button" onClick={() => add(slot)}>
                  <Plus size={16} />
                  Add food
                </button>
              </div>
              {rows.length ? (
                rows.map((entry) => (
                  <button
                    className="diary-entry"
                    key={entry.id}
                    onClick={() => setEditor({ meal: entry, existing: true })}
                  >
                    <div>
                      <strong>{entry.name}</strong>
                      <p>
                        {entry.status === "skipped"
                          ? "Skipped · No intake recorded"
                          : entry.foods
                              .map((f) => `${f.quantity} ${f.unit} ${f.name}`)
                              .join(" · ")}
                      </p>
                    </div>
                    <span>
                      {entry.status === "skipped"
                        ? "Skipped"
                        : `${formatValue(sumNutrition(entry.foods).kcal)} kcal`}
                    </span>
                    <ArrowUpRight size={17} />
                  </button>
                ))
              ) : (
                <Empty title={`No ${slot.toLowerCase()} logged yet.`}>
                  Whenever you’re ready, add a meal or choose one of your
                  usuals.
                </Empty>
              )}
            </section>
          );
        })}
      </div>
      {activeEditor && (
        <MealEditor
          key={`${activeEditor.meal?.id ?? "new"}-${date}`}
          initial={activeEditor.meal}
          existing={activeEditor.existing}
          date={date}
          onClose={() => {
            setEditor(null);
            if (params.has("add")) setParams({ date }, { replace: true });
          }}
        />
      )}
      {analysis && (
        <Analysis
          onClose={() => setAnalysis(false)}
          onReview={(meal) => {
            setAnalysis(false);
            setEditor({ meal });
          }}
        />
      )}
    </>
  );
}
