import {
  useEffect,
  useRef,
  type PropsWithChildren,
  type ReactNode,
} from "react";
import {
  X,
  ArrowUpRight,
  Utensils,
  Sun,
  Sunset,
  Moon,
  Coffee,
} from "lucide-react";
import { Link } from "react-router-dom";
import { formatValue, sumNutrition, type Meal, type Slot } from "../lib/model";
export function Logo() {
  return (
    <Link to="/" className="logo" aria-label="360 Fitness home">
      <span className="logo-mark">◔</span>
      <span>
        360<span className="logo-degree">°</span>
        <small>FITNESS</small>
      </span>
    </Link>
  );
}
export function Dialog({
  title,
  children,
  onClose,
  wide = false,
}: PropsWithChildren<{ title: string; onClose: () => void; wide?: boolean }>) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    d?.showModal();
    return () => d?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className={`modal ${wide ? "wide" : ""}`}
      aria-label={title}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="modal-inner">
        <header className="modal-header">
          <div>
            <span className="eyebrow">YOUR NUTRITION, YOUR WAY</span>
            <h2>{title}</h2>
          </div>
          <button
            className="icon-button"
            aria-label="Close dialog"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </header>
        {children}
      </div>
    </dialog>
  );
}
export function PageHeading({
  eyebrow,
  title,
  subtitle,
  action,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  action?: ReactNode;
}) {
  return (
    <header className="page-heading">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      {action}
    </header>
  );
}
export function Empty({
  title,
  children,
  action,
}: PropsWithChildren<{ title: string; action?: ReactNode }>) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <Utensils size={25} />
      </span>
      <h3>{title}</h3>
      <p>{children}</p>
      {action}
    </div>
  );
}
export function Notice({
  children,
  error = false,
}: PropsWithChildren<{ error?: boolean }>) {
  return (
    <div
      role={error ? "alert" : undefined}
      className={`notice ${error ? "error" : ""}`}
    >
      {children}
    </div>
  );
}
export function SlotIcon({ slot, size = 20 }: { slot: Slot; size?: number }) {
  const Icon = { Breakfast: Sun, Lunch: Sunset, Dinner: Moon, Snack: Coffee }[
    slot
  ];
  return <Icon size={size} />;
}
export function MealTile({
  meal,
  onClick,
  action = "View meal",
}: {
  meal: Meal;
  onClick: () => void;
  action?: string;
}) {
  const total = sumNutrition(meal.foods);
  return (
    <button className="meal-tile" onClick={onClick}>
      <div className={`meal-art ${meal.slot.toLowerCase()}`}>
        <SlotIcon slot={meal.slot} size={30} />
        <span>{meal.slot}</span>
      </div>
      <div className="meal-tile-body">
        <span className="eyebrow">
          {meal.foods.length} INGREDIENT{meal.foods.length === 1 ? "" : "S"}
        </span>
        <h3>{meal.name}</h3>
        <p>
          {formatValue(total.kcal)} kcal <span>·</span>{" "}
          {formatValue(total.protein)}g protein
        </p>
        <span className="tile-action">
          {action}
          <ArrowUpRight size={18} />
        </span>
      </div>
    </button>
  );
}
export function ProgressRing({
  value,
  target,
  label,
}: {
  value: number | null;
  target: number | null;
  label: string;
}) {
  const ratio = target && value !== null ? Math.min(value / target, 1) : 0;
  return (
    <div
      className="progress-ring"
      role="img"
      aria-label={`${formatValue(value)} ${label}${target ? ` of ${target}` : ""}`}
    >
      <svg viewBox="0 0 160 160" aria-hidden="true">
        <circle
          cx="80"
          cy="80"
          r="66"
          fill="none"
          stroke="#ffffff15"
          strokeWidth="10"
        />
        <circle
          cx="80"
          cy="80"
          r="66"
          fill="none"
          stroke="currentColor"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray="414.69"
          strokeDashoffset={414.69 * (1 - ratio)}
          transform="rotate(-90 80 80)"
        />
      </svg>
      <div>
        <strong>{formatValue(value)}</strong>
        <span>{label}</span>
      </div>
    </div>
  );
}
export function FoodIllustration() {
  return (
    <svg
      className="food-illustration"
      viewBox="0 0 480 480"
      role="img"
      aria-label="An illustrated balanced bowl with greens, grains and vegetables"
    >
      <defs>
        <radialGradient id="plate">
          <stop stopColor="#fffef7" />
          <stop offset=".82" stopColor="#ececdb" />
          <stop offset="1" stopColor="#fdfdf3" />
        </radialGradient>
      </defs>
      <ellipse
        cx="242"
        cy="268"
        rx="189"
        ry="180"
        fill="#151713"
        opacity=".1"
      />
      <circle cx="240" cy="240" r="188" fill="url(#plate)" />
      <circle cx="240" cy="240" r="157" fill="#e4e3c8" />
      {Array.from({ length: 13 }, (_, i) => (
        <ellipse
          key={i}
          cx={159 + (i % 4) * 26}
          cy={147 + Math.floor(i / 4) * 32}
          rx="31"
          ry="18"
          fill={["#527443", "#77945b", "#45633b"][i % 3]}
          transform={`rotate(${i * 31} ${159 + (i % 4) * 26} ${147 + Math.floor(i / 4) * 32})`}
        />
      ))}
      {Array.from({ length: 25 }, (_, i) => (
        <ellipse
          key={i}
          cx={260 + (i % 5) * 15}
          cy={143 + Math.floor(i / 5) * 16}
          rx="10"
          ry="5"
          fill={["#d1b985", "#dfcb9c", "#efe0b6"][i % 3]}
          transform={`rotate(${i * 17} ${260 + (i % 5) * 15} ${143 + Math.floor(i / 5) * 16})`}
        />
      ))}
      {[0, 1, 2].map((i) => (
        <g
          key={i}
          transform={`translate(${140 + i * 39} ${265 + i * 13}) rotate(-30)`}
        >
          <rect width="43" height="90" rx="20" fill="#446e3a" />
          <rect x="6" y="5" width="31" height="80" rx="15" fill="#afc677" />
          <rect x="12" y="15" width="19" height="60" rx="10" fill="#dbe8ae" />
        </g>
      ))}
      {[0, 1, 2, 3, 4].map((i) => (
        <g key={i}>
          <circle
            cx={286 + (i % 2) * 35}
            cy={272 + Math.floor(i / 2) * 31}
            r="21"
            fill="#c76740"
          />
          <circle
            cx={286 + (i % 2) * 35}
            cy={272 + Math.floor(i / 2) * 31}
            r="15"
            fill="#e18d62"
          />
          <path
            d={`M${276 + (i % 2) * 35} ${272 + Math.floor(i / 2) * 31}h20`}
            stroke="#f7c29a"
            strokeWidth="3"
          />
        </g>
      ))}
    </svg>
  );
}
