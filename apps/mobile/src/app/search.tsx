import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Redirect, router, useLocalSearchParams } from "expo-router";
import {
  Button,
  Copy,
  Field,
  Header,
  Icon,
  Notice,
  Screen,
  Section,
  styles,
} from "../components/ui";
import { useApp } from "../data/store";
import {
  basketMeal,
  candidateFood,
  FoodCandidate,
  foodHistory,
  repeatFood,
} from "../domain/food-search";
import { Food, formatValue, slots, Slot, sumNutrition } from "../domain/meals";
import { createFoodSearch } from "../services/food-search";
import { defaultRoute } from "../services/food-search-route";
import { labelConnection } from "../services/label-connection";
import { colors as c, radius } from "../theme";

const search = createFoodSearch({
  fetcher: (...args) => fetch(...args),
  route: defaultRoute(),
  connect: labelConnection,
});

function isSlot(value: unknown): value is Slot {
  return slots.includes(value as Slot);
}

function defaultSlot(now = new Date()): Slot {
  const hour = now.getHours();
  return hour < 11
    ? "Breakfast"
    : hour < 15
      ? "Lunch"
      : hour < 21
        ? "Dinner"
        : "Snack";
}

export default function SearchRoute() {
  const params = useLocalSearchParams<{
    slot?: string;
    mode?: string;
    date?: string;
  }>();
  const { ready } = useApp();
  if (!ready) return <Redirect href="/" />;
  return (
    <FoodSearch
      initialSlot={isSlot(params.slot) ? params.slot : defaultSlot()}
      template={params.mode === "template"}
      date={params.date}
    />
  );
}

function FoodSearch({
  initialSlot,
  template,
  date,
}: {
  initialSlot: Slot;
  template: boolean;
  date?: string;
}) {
  const { state, setPendingMeal } = useApp();
  const [slot, setSlot] = useState<Slot>(initialSlot);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FoodCandidate[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sort, setSort] = useState<"recent" | "frequent">("recent");
  const [basket, setBasket] = useState<Food[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const latest = useRef(0);

  const history = useMemo(
    () => foodHistory(state.entries, sort).slice(0, 15),
    [state.entries, sort],
  );
  const searching = query.trim().length >= 2;

  useEffect(() => {
    const id = ++latest.current;
    if (!searching) return;
    const controller = new AbortController();
    // Debounce typing; only the newest request may update the screen.
    const timer = setTimeout(() => {
      search(query, controller.signal)
        .then((outcome) => {
          if (id === latest.current) setResults(outcome.results);
        })
        .catch((cause: Error) => {
          if (id === latest.current && cause.message !== "cancelled") {
            setResults([]);
            setError(cause.message);
          }
        })
        .finally(() => {
          if (id === latest.current) setBusy(false);
        });
    }, 400);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, searching]);

  function add(food: Food) {
    if (basket.length >= 30) {
      setError("A meal can hold up to 30 foods.");
      return;
    }
    setBasket((items) => [...items, food]);
    setOpen(null);
    setNotice(`Added ${food.name} — not logged until you review and confirm.`);
  }

  function review() {
    try {
      const meal = basketMeal(basket, slot);
      setPendingMeal(meal);
      router.push({
        pathname: "/meal",
        params: {
          draft: meal.id,
          mode: template ? "template" : "log",
          ...(date ? { date } : {}),
        },
      });
    } catch (cause) {
      setError((cause as Error).message);
    }
  }

  const total = sumNutrition(basket);
  return (
    <Screen
      footer={
        basket.length ? (
          <View style={{ gap: 10 }}>
            <Copy muted style={{ fontSize: 13 }}>
              {basket.length} {basket.length === 1 ? "food" : "foods"} ·{" "}
              {formatValue(total.kcal)} kcal · {slot}
            </Copy>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Button
                  secondary
                  onPress={() => setBasket((items) => items.slice(0, -1))}
                >
                  Undo last
                </Button>
              </View>
              <View style={{ flex: 2 }}>
                <Button icon="checkmark" onPress={review}>
                  Review meal
                </Button>
              </View>
            </View>
          </View>
        ) : undefined
      }
    >
      <Header
        back
        eyebrow={template ? "Usual meal" : "Log food"}
        title="Search foods"
        subtitle="Add foods to your meal, then review portions before anything is saved."
      />
      <View style={s.chips} accessibilityRole="radiogroup">
        {slots.map((item) => (
          <Pressable
            key={item}
            accessibilityRole="radio"
            aria-checked={slot === item}
            onPress={() => setSlot(item)}
            style={[s.chip, slot === item && s.chipOn]}
          >
            <Text style={[s.chipText, slot === item && { color: c.accent }]}>
              {item}
            </Text>
          </Pressable>
        ))}
      </View>
      <Field
        label="Food name or brand"
        placeholder="e.g. banana, greek yogurt"
        value={query}
        onChangeText={(value) => {
          // Reset here rather than in the effect, so typing renders once.
          setQuery(value);
          setError("");
          const active = value.trim().length >= 2;
          setBusy(active);
          if (!active) setResults([]);
        }}
        autoCorrect={false}
        returnKeyType="search"
        maxLength={80}
      />
      {notice ? (
        <Copy muted style={{ fontSize: 12 }}>
          {notice}
        </Copy>
      ) : null}
      {error ? <Notice error>{error}</Notice> : null}

      {searching ? (
        <>
          {error ? null : (
            <Section
              title="Results"
              detail={busy ? "Searching…" : `${results.length} found`}
            />
          )}
          {busy && !results.length ? (
            <ActivityIndicator color={c.accent} />
          ) : null}
          {!busy && !error && !results.length ? (
            <Copy muted>
              No matches. Try a simpler name, or enter the food manually.
            </Copy>
          ) : null}
          {results.map((item) => (
            <ResultRow
              key={item.id}
              item={item}
              expanded={open === item.id}
              onToggle={() => setOpen(open === item.id ? null : item.id)}
              onAdd={add}
            />
          ))}
          {results.length ? (
            <Copy muted style={{ fontSize: 11 }}>
              Data from USDA FoodData Central and Open Food Facts contributors
              (ODbL). Values are per the source; check packaged foods against
              the label.
            </Copy>
          ) : null}
        </>
      ) : (
        <>
          <View style={styles.row}>
            <Section title="Your foods" detail="From meals you've confirmed" />
          </View>
          {history.length ? (
            <View style={s.chips}>
              {(["recent", "frequent"] as const).map((item) => (
                <Pressable
                  key={item}
                  accessibilityRole="radio"
                  aria-checked={sort === item}
                  onPress={() => setSort(item)}
                  style={[s.chip, sort === item && s.chipOn]}
                >
                  <Text
                    style={[s.chipText, sort === item && { color: c.accent }]}
                  >
                    {item === "recent" ? "Most recent" : "Most frequent"}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : (
            <Copy muted>
              Foods you log will appear here so you can add them again in one
              tap.
            </Copy>
          )}
          {history.map((item) => (
            <View key={item.key} style={s.row}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={s.name} numberOfLines={2}>
                  {item.food.name}
                </Text>
                <Copy muted style={{ fontSize: 12 }}>
                  {formatValue(item.food.quantity)} {item.food.unit} ·{" "}
                  {formatValue(item.food.nutrition.kcal)} kcal · logged{" "}
                  {item.count}×
                </Copy>
              </View>
              <AddButton
                label={`Add ${item.food.name}`}
                onPress={() => add(repeatFood(item.food))}
              />
            </View>
          ))}
          <Button
            secondary
            icon="create-outline"
            onPress={() =>
              router.push({
                pathname: "/meal",
                params: {
                  mode: template ? "template" : "log",
                  ...(date ? { date } : {}),
                },
              })
            }
          >
            Enter a food manually
          </Button>
        </>
      )}
    </Screen>
  );
}

function ResultRow({
  item,
  expanded,
  onToggle,
  onAdd,
}: {
  item: FoodCandidate;
  expanded: boolean;
  onToggle: () => void;
  onAdd: (food: Food) => void;
}) {
  const [serving, setServing] = useState(0);
  const [count, setCount] = useState("1");
  const [error, setError] = useState("");
  const chosen = item.servings[serving] ?? item.servings[0];
  function addChosen() {
    try {
      const amount = Number(count.replace(",", "."));
      if (!Number.isFinite(amount) || amount <= 0 || amount > 100)
        throw new Error("Enter a number of servings from 0.1 to 100.");
      onAdd(candidateFood(item, chosen.amount, amount));
    } catch (cause) {
      setError((cause as Error).message);
    }
  }
  return (
    <View style={[s.result, expanded && { borderColor: c.accent }]}>
      <View style={s.row}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Choose a portion of ${item.name}`}
          onPress={onToggle}
          style={{ flex: 1, gap: 2 }}
        >
          <Text style={s.name} numberOfLines={2}>
            {item.name}
          </Text>
          <Copy muted style={{ fontSize: 12 }}>
            {[
              item.brand,
              item.source === "usda" ? "USDA" : "Open Food Facts",
              `${formatValue(item.per100.kcal)} kcal / 100 ${item.basis}`,
            ]
              .filter(Boolean)
              .join(" · ")}
          </Copy>
        </Pressable>
        <AddButton
          label={`Add ${chosen.label} of ${item.name}`}
          onPress={() => onAdd(candidateFood(item, chosen.amount))}
        />
      </View>
      {expanded ? (
        <View style={{ gap: 10 }}>
          <View style={s.chips}>
            {item.servings.map((option, index) => (
              <Pressable
                key={option.label}
                accessibilityRole="radio"
                aria-checked={serving === index}
                onPress={() => setServing(index)}
                style={[s.chip, serving === index && s.chipOn]}
              >
                <Text
                  style={[s.chipText, serving === index && { color: c.accent }]}
                >
                  {option.label}
                </Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.row}>
            <Field
              label="Servings"
              value={count}
              onChangeText={(value) => {
                setCount(value);
                setError("");
              }}
              keyboardType="decimal-pad"
              maxLength={5}
            />
            <View style={{ flex: 1, justifyContent: "flex-end" }}>
              <Button icon="add" onPress={addChosen}>
                Add
              </Button>
            </View>
          </View>
          {error ? <Notice error>{error}</Notice> : null}
          <Copy muted style={{ fontSize: 12 }}>
            Per 100 {item.basis}: {formatValue(item.per100.protein)} g protein ·{" "}
            {formatValue(item.per100.carbs)} g carbs ·{" "}
            {formatValue(item.per100.fat)} g fat
          </Copy>
        </View>
      ) : null}
    </View>
  );
}

function AddButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [s.add, pressed && { opacity: 0.7 }]}
    >
      <Icon name="add" color={c.onAccent} size={22} />
    </Pressable>
  );
}

const s = StyleSheet.create({
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surface,
  },
  chipOn: { borderColor: c.accent, backgroundColor: c.accentSoft },
  chipText: { color: c.muted, fontSize: 13, fontWeight: "600" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
  },
  result: {
    gap: 6,
    padding: 12,
    borderRadius: radius.small,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surface,
  },
  name: { color: c.text, fontSize: 15, fontWeight: "600" },
  add: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: c.accent,
  },
});
