import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, CalendarDays, Utensils, TrendingUp } from "lucide-react";
import { useStore } from "../lib/store";
import {
  historyDays,
  averageLogged,
  formatValue,
  type Nutrients,
} from "../lib/model";
import { PageHeading } from "../components/ui";
export default function Progress() {
  const { state } = useStore();
  const [period, setPeriod] = useState(7),
    [metric, setMetric] = useState<"kcal" | "protein">("kcal");
  const days = historyDays(state.entries, period);
  const known = days.filter((d) => d.nutrition?.[metric] != null);
  const max = Math.max(1, ...known.map((d) => d.nutrition![metric]!));
  const logged = days.filter((d) => d.meals > 0);
  return (
    <>
      <PageHeading
        eyebrow="THE BIGGER PICTURE"
        title="Your rhythm, over time."
        subtitle="Small, everyday choices. A little perspective on how they add up."
        action={
          <div className="segmented">
            {[7, 30, 90].map((n) => (
              <button
                key={n}
                className={n === period ? "active" : ""}
                onClick={() => setPeriod(n)}
              >
                {n} days
              </button>
            ))}
          </div>
        }
      />
      <div className="insight-stats">
        {[
          [CalendarDays, `${logged.length} / ${period}`, "Days with meals"],
          [
            Utensils,
            String(days.reduce((n, d) => n + d.meals, 0)),
            "Meals logged",
          ],
          [
            TrendingUp,
            formatValue(averageLogged(days, "kcal")),
            "Average kcal logged",
          ],
        ].map(([Icon, value, label]) => {
          const Symbol = Icon as typeof CalendarDays;
          return (
            <section className="panel insight-stat" key={String(label)}>
              <Symbol size={20} />
              <strong>{String(value)}</strong>
              <span>{String(label)}</span>
            </section>
          );
        })}
      </div>
      <section className="panel chart-panel">
        <div className="section-top">
          <div>
            <span className="eyebrow">YOUR LOGGED NUTRITION</span>
            <h2>{metric === "kcal" ? "Calories" : "Protein"} over time</h2>
          </div>
          <div className="segmented">
            {(["kcal", "protein"] as const).map((key) => (
              <button
                key={key}
                className={metric === key ? "active" : ""}
                onClick={() => setMetric(key)}
              >
                {key === "kcal" ? "Calories" : "Protein"}
              </button>
            ))}
          </div>
        </div>
        <div className="chart-scale">
          <span>
            {known.length ? formatValue(max) : "—"}{" "}
            {metric === "kcal" ? "kcal" : "g"}
          </span>
          <span>Tap a day to open its diary</span>
        </div>
        <div className="chart-scroll">
          <div
            className="bar-chart"
            style={{ minWidth: period > 30 ? period * 20 : undefined }}
          >
            {days.map((day) => {
              const value = day.nutrition?.[metric] ?? null;
              return (
                <Link
                  to={`/app/diary?date=${day.date}`}
                  key={day.date}
                  title={`${day.date}: ${value === null ? "No complete estimate" : `${formatValue(value)} ${metric === "kcal" ? "kcal" : "g"}`}`}
                  aria-label={`${day.date}: ${value === null ? "No complete estimate" : `${formatValue(value)} ${metric === "kcal" ? "kcal" : "g"}`}`}
                  className={value === null ? "missing" : ""}
                >
                  {value !== null ? (
                    <div
                      className={`bar ${metric}`}
                      style={{ height: `${Math.max(1, (value / max) * 85)}%` }}
                    />
                  ) : (
                    <span className="missing-mark">–</span>
                  )}
                  {period <= 30 && <small>{Number(day.date.slice(-2))}</small>}
                </Link>
              );
            })}
          </div>
        </div>
        <div className="chart-scale">
          <span>{days[0].date}</span>
          <span>{days.at(-1)?.date}</span>
        </div>
        <p className="muted small-copy">
          Averages include only the {known.length} days with complete{" "}
          {metric === "kcal" ? "calorie" : "protein"} estimates. Missing days,
          skipped meals and unknown nutrition are excluded. A logged day may
          still be incomplete.
        </p>
      </section>
      <div className="two-column">
        <section className="panel">
          <span className="eyebrow">YOUR AVERAGE BREAKDOWN</span>
          <h2>Get to know your macros.</h2>
          <div className="macro-averages">
            {(["protein", "carbs", "fat"] as (keyof Nutrients)[]).map(
              (key, i) => (
                <div key={key}>
                  <span className={`macro-dot dot-${i}`} />
                  <span>{key}</span>
                  <strong>
                    {formatValue(averageLogged(days, key))}
                    <small>g / logged day</small>
                  </strong>
                </div>
              ),
            )}
          </div>
        </section>
        <section className="routine-prompt">
          <span className="eyebrow">PROGRESS HAS MANY SHAPES</span>
          <h2>
            Consistency,
            <br />
            without the pressure.
          </h2>
          <p>
            These numbers tell part of your story.
            <br />
            How you feel matters, too.
          </p>
          <Link className="text-button" to="/app/settings">
            Adjust your personal goals
            <ArrowUpRight size={17} />
          </Link>
        </section>
      </div>
    </>
  );
}
