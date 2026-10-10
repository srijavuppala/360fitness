import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  Plus,
  Sparkles,
  Droplets,
  ArrowRight,
  Check,
  Flame,
} from "lucide-react";
import { useStore } from "../lib/store";
import {
  dailyNutrition,
  localDate,
  formatValue,
  starterMeals,
  id,
  sumNutrition,
  lastDays,
  type Meal,
} from "../lib/model";
import { PageHeading, ProgressRing, SlotIcon } from "../components/ui";
import { MealEditor } from "../components/MealEditor";
import { Analysis } from "../components/Analysis";
export default function Dashboard() {
  const { state, update, busy } = useStore();
  const [editor, setEditor] = useState<Meal | null>(null),
    [analysis, setAnalysis] = useState(false);
  const today = localDate();
  const meals = state.entries.filter(
    (e) => e.date === today && e.status === "confirmed",
  );
  const total = dailyNutrition(state.entries, today);
  const water = state.water.filter((w) => w.date === today);
  const ml = water.reduce((s, w) => s + w.ml, 0);
  const days = lastDays(7);
  const routine = state.templates.length ? state.templates : starterMeals;
  const greeting =
    new Date().getHours() < 12
      ? "Good morning"
      : new Date().getHours() < 17
        ? "Good afternoon"
        : "Good evening";
  return (
    <>
      <PageHeading
        eyebrow="LET’S MAKE TODAY A GOOD ONE"
        title={`${greeting}${state.profile.name ? `, ${state.profile.name.split(" ")[0]}` : ""}.`}
        subtitle="A little awareness. A little consistency. A healthier everyday."
        action={
          <button
            className="button secondary"
            onClick={() => setAnalysis(true)}
          >
            <Sparkles size={16} />
            Describe a meal
          </button>
        }
      />
      <div className="dashboard-grid">
        <section className="nutrition-hero">
          <div className="hero-top">
            <span className="eyebrow">TODAY’S NUTRITION</span>
            <span className="dark-pill">
              <Flame size={13} />
              {meals.length} meal{meals.length === 1 ? "" : "s"} logged
            </span>
          </div>
          <div className="nutrition-main">
            <div>
              <h2>
                Every meal is
                <br />a fresh start.
              </h2>
              <p>
                {total.kcal === null
                  ? "Some calorie values are unknown."
                  : state.profile.kcal
                    ? `${formatValue(Math.max(0, state.profile.kcal - total.kcal))} kcal to your personal target`
                    : "Get to know your food, one meal at a time."}
              </p>
              <Link to="/app/diary">
                View food diary
                <ArrowUpRight size={16} />
              </Link>
            </div>
            <ProgressRing
              value={total.kcal}
              target={state.profile.kcal}
              label="kcal logged"
            />
          </div>
          <div className="macro-grid">
            {(["protein", "carbs", "fat"] as const).map((key, i) => (
              <div key={key} className={`macro macro-${i}`}>
                <span>
                  <i />
                  {key}
                </span>
                <strong>
                  {formatValue(total[key])}
                  <small>
                    {" "}
                    g{state.profile[key] ? ` / ${state.profile[key]}g` : ""}
                  </small>
                </strong>
                <div className="macro-track">
                  <div
                    style={{
                      width:
                        state.profile[key] && total[key] !== null
                          ? `${Math.min(100, (total[key]! / state.profile[key]!) * 100)}%`
                          : "0%",
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
        <section className="water-card">
          <div className="section-top">
            <span className="eyebrow">A MOMENT TO HYDRATE</span>
            <Droplets size={19} />
          </div>
          <h2>Keep it flowing.</h2>
          <p>Little sips add up.</p>
          <div className="water-visual">
            <div
              className="water-fill"
              style={{
                height: `${Math.min(100, (ml / state.profile.water) * 100)}%`,
              }}
            />
            <Droplets size={34} />
          </div>
          <strong className="water-value">
            {(ml / 1000).toFixed(2)}
            <small> / {(state.profile.water / 1000).toFixed(1)} L</small>
          </strong>
          <div className="water-actions">
            <button
              disabled={busy}
              onClick={() =>
                update(
                  (prev) => ({
                    ...prev,
                    water: [
                      ...prev.water,
                      {
                        id: id(),
                        date: today,
                        ml: 250,
                        createdAt: new Date().toISOString(),
                      },
                    ],
                  }),
                  "Added 250 ml",
                )
              }
            >
              <Plus size={15} />
              250 ml
            </button>
            <button
              disabled={busy}
              onClick={() =>
                update(
                  (prev) => ({
                    ...prev,
                    water: [
                      ...prev.water,
                      {
                        id: id(),
                        date: today,
                        ml: 500,
                        createdAt: new Date().toISOString(),
                      },
                    ],
                  }),
                  "Added 500 ml",
                )
              }
            >
              <Plus size={15} />
              500 ml
            </button>
          </div>
          <button
            className="text-button"
            disabled={busy || !water.length}
            onClick={() => {
              const last = [...water]
                .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
                .at(-1);
              if (last)
                void update(
                  (prev) => ({
                    ...prev,
                    water: prev.water.filter((w) => w.id !== last.id),
                  }),
                  "Water entry undone",
                );
            }}
          >
            Undo last glass
          </button>
        </section>
      </div>
      <div className="two-column">
        <section className="panel">
          <div className="section-top">
            <div>
              <span className="eyebrow">ONE DAY AT A TIME</span>
              <h2>Your week in check-ins</h2>
            </div>
            <Link
              className="icon-link"
              aria-label="View progress"
              to="/app/progress"
            >
              <ArrowUpRight size={21} />
            </Link>
          </div>
          <div className="week-row">
            {days.map((date) => {
              const logged = state.entries.some((e) => e.date === date);
              return (
                <Link
                  to={`/app/diary?date=${date}`}
                  key={date}
                  className={date === today ? "today" : ""}
                >
                  <span>
                    {new Date(`${date}T12:00:00`).toLocaleDateString("en-US", {
                      weekday: "short",
                    })}
                  </span>
                  <span className={`day-circle ${logged ? "checked" : ""}`}>
                    {logged ? <Check size={18} /> : Number(date.slice(-2))}
                  </span>
                </Link>
              );
            })}
          </div>
          <p className="muted small-copy">
            A missing day is just missing data. Pick up wherever you are.
          </p>
        </section>
        <section className="routine-prompt">
          <span className="eyebrow">LESS THINKING. MORE LIVING.</span>
          <h2>
            Your usual meals,
            <br />
            one tap away.
          </h2>
          <p>
            Save the meals you come back to.
            <br />
            Give tomorrow one less decision.
          </p>
          <Link to="/app/plan" className="text-button">
            Make it a routine
            <ArrowRight size={17} />
          </Link>
          <span className="prompt-flower" aria-hidden="true">
            ✳
          </span>
        </section>
      </div>
      <div className="section-top spaced">
        <div>
          <span className="eyebrow">
            {state.templates.length
              ? "YOUR GO-TO MEALS"
              : "A LITTLE INSPIRATION"}
          </span>
          <h2>
            {state.templates.length ? "On your menu" : "Make a meal your own"}
          </h2>
        </div>
        <Link to="/app/plan" className="text-button">
          View meal plan
          <ArrowUpRight size={16} />
        </Link>
      </div>
      <div className="quick-meals">
        {routine.slice(0, 3).map((meal) => (
          <button
            className="quick-meal"
            key={meal.id}
            onClick={() => setEditor(meal)}
          >
            <span className={`slot-icon ${meal.slot.toLowerCase()}`}>
              <SlotIcon slot={meal.slot} />
            </span>
            <span>
              <small>
                {meal.slot}
                {!state.templates.length ? " · Starter idea" : ""}
              </small>
              <strong>{meal.name}</strong>
              <span>
                {formatValue(sumNutrition(meal.foods).kcal)} kcal · Review
                portions
              </span>
            </span>
            <Plus size={18} />
          </button>
        ))}
      </div>
      {editor && (
        <MealEditor initial={editor} onClose={() => setEditor(null)} />
      )}{" "}
      {analysis && (
        <Analysis
          onClose={() => setAnalysis(false)}
          onReview={(meal) => {
            setAnalysis(false);
            setEditor(meal);
          }}
        />
      )}
    </>
  );
}
