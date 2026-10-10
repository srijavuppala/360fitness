import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Linking, Pressable, Text, View } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { BarcodeCamera } from "../components/barcode-camera";
import {
  Button,
  Card,
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
  formatProductValue,
  normalizeBarcode,
  productMeal,
  productSummary,
} from "../domain/product-scan";
import { lookupProduct } from "../services/products";
import type { LookupResult } from "../services/product-lookup";
import { colors as c } from "../theme";

export default function Scan() {
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const { setPendingMeal } = useApp();
  const [barcode, setBarcode] = useState("");
  const [camera, setCamera] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<LookupResult | null>(null);
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState<"g" | "ml" | null>(null);
  const [labelChecked, setLabelChecked] = useState(false);
  const inFlight = useRef(false);
  const active = useRef(true);
  const generation = useRef(0);
  const request = useRef<AbortController | null>(null);
  useFocusEffect(
    useCallback(() => {
      active.current = true;
      return () => {
        active.current = false;
        generation.current++;
        request.current?.abort();
        inFlight.current = false;
        setBusy(false);
        setCamera(false);
      };
    }, []),
  );
  useEffect(() => {
    const listener = AppState.addEventListener("change", (next) => {
      if (next !== "active") setCamera(false);
    });
    return () => listener.remove();
  }, []);
  async function lookup(raw: string) {
    if (inFlight.current) return;
    setCamera(false);
    setError("");
    setResult(null);
    setLabelChecked(false);
    setQuantity("");
    setUnit(null);
    let code: string;
    try {
      code = normalizeBarcode(raw);
    } catch (cause) {
      setError((cause as Error).message);
      return;
    }
    setBarcode(code);
    inFlight.current = true;
    setBusy(true);
    const current = ++generation.current;
    const controller = new AbortController();
    request.current = controller;
    try {
      const response = await lookupProduct(code, controller.signal);
      if (active.current && current === generation.current) setResult(response);
    } catch (cause) {
      if (active.current && current === generation.current)
        setError(
          cause instanceof Error ? cause.message : "Lookup failed. Try again.",
        );
    } finally {
      if (current === generation.current) {
        inFlight.current = false;
        setBusy(false);
      }
    }
  }
  function review() {
    if (!result || !unit || !labelChecked) return;
    try {
      const meal = productMeal(result.product, Number(quantity), unit);
      setPendingMeal(meal);
      router.push({
        pathname: "/meal",
        params: {
          draft: meal.id,
          mode: mode === "template" ? "template" : "log",
        },
      });
    } catch (cause) {
      setError((cause as Error).message);
    }
  }
  const p = result?.product;
  const gradeColor =
    p?.grade === "d" || p?.grade === "e"
      ? c.danger
      : p?.grade === "c"
        ? c.orange
        : p?.grade
          ? c.accent
          : c.muted;
  return (
    <Screen>
      <Header
        back
        eyebrow="SCAN · UNDERSTAND · CHOOSE"
        title="What’s in your food?"
        subtitle="A closer look at the things you pick up."
      />
      {p ? (
        <Button
          secondary
          icon="scan-outline"
          onPress={() => {
            setResult(null);
            setError("");
            setLabelChecked(false);
          }}
        >
          Scan another product
        </Button>
      ) : (
        <>
          <Card style={{ backgroundColor: c.accentSoft }}>
            <View style={styles.row}>
              <Icon name="barcode-outline" size={32} color={c.accent} />
              <View style={{ flex: 1 }}>
                <Copy>Know the product. Check the label.</Copy>
                <Copy muted style={{ fontSize: 12 }}>
                  Packaged-food barcode scanner
                </Copy>
              </View>
            </View>
            <Copy muted style={{ fontSize: 13 }}>
              Lookup sends the barcode to Open Food Facts. Camera images stay on
              your phone; your meal history is not sent.
            </Copy>
            {!camera ? (
              <Button
                icon="scan-outline"
                disabled={busy}
                onPress={() => {
                  setError("");
                  setCamera(true);
                }}
              >
                Scan a barcode
              </Button>
            ) : (
              <BarcodeCamera onScan={lookup} onClose={() => setCamera(false)} />
            )}
          </Card>
          <Card>
            <Field
              label="Barcode number"
              value={barcode}
              onChangeText={(value) => {
                setBarcode(value);
                setError("");
              }}
              keyboardType="number-pad"
              maxLength={24}
              placeholder="Digits below the product barcode"
              editable={!busy}
            />
            <Button
              secondary
              icon="search-outline"
              disabled={!barcode.trim()}
              busy={busy}
              onPress={() => lookup(barcode)}
            >
              {busy ? "Looking up product…" : "Look up product"}
            </Button>
          </Card>
        </>
      )}
      {error ? <Notice error>{error}</Notice> : null}
      {!p ? (
        <Card>
          <Copy>No barcode match?</Copy>
          <Copy muted>
            Use a photo of the nutrition label and copy its values into a
            portion you can review.
          </Copy>
          <Button
            secondary
            icon="camera-outline"
            disabled={busy}
            onPress={() =>
              router.push({
                pathname: "/label",
                params: { mode: mode === "template" ? "template" : "log" },
              })
            }
          >
            Read a label instead
          </Button>
        </Card>
      ) : null}
      {p && result ? (
        <>
          <View style={{ gap: 6 }}>
            <Text
              selectable
              style={{ color: c.muted, fontSize: 11, letterSpacing: 1 }}
            >
              PRODUCT FOUND
            </Text>
            <Text
              selectable
              accessibilityRole="header"
              style={{ color: c.text, fontSize: 29, fontWeight: "700" }}
            >
              {p.name}
            </Text>
            <Copy muted>
              {p.brands || "Brand not provided"} · {p.barcode}
            </Copy>
          </View>
          <Card>
            <View style={styles.row}>
              <View style={{ flex: 1, gap: 8 }}>
                <Copy muted>Reported Nutri-Score</Copy>
                <Text
                  selectable
                  style={{
                    color: c.text,
                    fontSize: 21,
                    lineHeight: 28,
                    fontWeight: "600",
                  }}
                >
                  {productSummary(p)}
                </Text>
              </View>
              <View
                style={{
                  width: 65,
                  height: 65,
                  borderRadius: 20,
                  backgroundColor: c.accentSoft,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text
                  selectable
                  style={{ color: gradeColor, fontSize: 35, fontWeight: "700" }}
                >
                  {p.grade?.toUpperCase() || "?"}
                </Text>
              </View>
            </View>
            <Copy muted style={{ fontSize: 12 }}>
              A–E describes nutritional quality, with A more favorable and E
              less favorable. Compare similar foods. It does not decide whether
              a product suits your allergies or individual needs.
            </Copy>
            <Copy muted style={{ fontSize: 12 }}>
              A product is part of a whole diet. The portion and how often you
              eat it matter too.
            </Copy>
          </Card>
          <Section title="What to notice" />
          <Card>
            {(
              [
                ["Sugars", p.sugars, p.levels.sugars],
                ["Saturated fat", p.saturatedFat, p.levels["saturated-fat"]],
                ["Salt", p.salt, p.levels.salt],
              ] as const
            ).map(([name, value, level]) => (
              <View key={name} style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Copy>{name}</Copy>
                  <Copy muted style={{ fontSize: 12 }}>
                    {value === null
                      ? "Not provided"
                      : `${formatProductValue(value)} g / 100 g or ml`}
                  </Copy>
                </View>
                <Text
                  selectable
                  style={{
                    color:
                      value !== null && level === "high" ? c.danger : c.muted,
                    fontWeight: "600",
                  }}
                >
                  {value !== null && level
                    ? level === "high"
                      ? "High"
                      : level === "low"
                        ? "Low"
                        : "Moderate"
                    : "Unknown"}
                </Text>
              </View>
            ))}
            <Copy muted style={{ fontSize: 11 }}>
              Levels are reported by Open Food Facts. Check the package for the
              measurement basis and latest recipe.
            </Copy>
            <View
              style={{
                borderTopWidth: 1,
                borderColor: c.border,
                paddingTop: 14,
                gap: 6,
              }}
            >
              <Copy>
                Processing: {p.nova ? `NOVA ${p.nova} of 4` : "Not provided"}
              </Copy>
              <Copy muted style={{ fontSize: 12 }}>
                {p.nova
                  ? [
                      "",
                      "Unprocessed or minimally processed foods",
                      "Processed culinary ingredients",
                      "Processed foods",
                      "Ultra-processed foods",
                    ][p.nova]
                  : "The database has not assigned a processing group."}{" "}
                · Processing is a separate classification from nutritional
                quality.
              </Copy>
            </View>
          </Card>
          <Section title="Nutrition at a glance" detail="PER 100 G / ML" />
          <Card>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 20 }}>
              {(
                [
                  ["Energy", p.nutrition.kcal, "kcal"],
                  ["Protein", p.nutrition.protein, "g"],
                  ["Carbs", p.nutrition.carbs, "g"],
                  ["Fat", p.nutrition.fat, "g"],
                  ["Fiber", p.fiber, "g"],
                ] as const
              ).map(([name, value, suffix]) => (
                <View key={name} style={{ width: "43%", gap: 4 }}>
                  <Copy muted style={{ fontSize: 12 }}>
                    {name}
                  </Copy>
                  <Text
                    selectable
                    style={{ color: c.text, fontSize: 23, fontWeight: "600" }}
                  >
                    {formatProductValue(value)}{" "}
                    <Text style={{ fontSize: 12 }}>{suffix}</Text>
                  </Text>
                </View>
              ))}
            </View>
            <Copy muted style={{ fontSize: 12 }}>
              These values are for 100 g or 100 ml, not the whole package. A
              dash means unavailable.
            </Copy>
          </Card>
          <Section title="Ingredients & allergens" />
          <Card>
            <Text
              selectable
              style={{ color: c.text, fontSize: 14, lineHeight: 22 }}
            >
              {p.ingredients ||
                "Ingredients were not provided. Read the package label."}
            </Text>
            <Copy>
              Listed allergens:{" "}
              {p.allergens.join(", ") || "None listed in this record"}
            </Copy>
            <Copy muted>
              Reported traces:{" "}
              {p.traces.join(", ") || "No trace information listed"}
            </Copy>
            <Notice>
              Missing or empty allergen data does not mean allergen-free. Check
              the physical label; this scanner cannot confirm allergy safety.
            </Notice>
          </Card>
          <Section title="Add the portion you ate" />
          <Card>
            {p.serving ? (
              <Copy muted>Package serving text: {p.serving}</Copy>
            ) : null}
            <Field
              label="Portion amount"
              value={quantity}
              onChangeText={setQuantity}
              keyboardType="decimal-pad"
              placeholder="e.g. 30"
              maxLength={7}
            />
            <Copy muted>Choose the same basis used on your package:</Copy>
            <View style={styles.row}>
              {(["g", "ml"] as const).map((value) => (
                <Pressable
                  key={value}
                  accessibilityRole="radio"
                  aria-checked={unit === value}
                  accessibilityLabel={value === "g" ? "Grams" : "Milliliters"}
                  onPress={() => {
                    setUnit(value);
                    setLabelChecked(false);
                  }}
                  style={{
                    flex: 1,
                    padding: 16,
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: unit === value ? c.accent : c.border,
                    backgroundColor: unit === value ? c.accentSoft : c.surface,
                  }}
                >
                  <Copy>
                    {value === "g" ? "Grams (g)" : "Milliliters (ml)"}
                  </Copy>
                </Pressable>
              ))}
            </View>
            <Pressable
              accessibilityRole="checkbox"
              aria-checked={labelChecked}
              onPress={() => setLabelChecked(!labelChecked)}
              style={{ flexDirection: "row", gap: 12, paddingVertical: 10 }}
            >
              <Icon
                name={labelChecked ? "checkbox" : "square-outline"}
                color={c.accent}
              />
              <View style={{ flex: 1 }}>
                <Copy style={{ fontSize: 13 }}>
                  I checked the product, nutrition and unit against the package.
                </Copy>
              </View>
            </Pressable>
            <Button
              disabled={!labelChecked || !unit || !quantity.trim()}
              onPress={review}
            >
              Review portion before logging
            </Button>
            <Copy muted style={{ fontSize: 12 }}>
              Nothing is logged until you confirm on the next screen.
            </Copy>
          </Card>
          <Card>
            <Copy muted style={{ fontSize: 12 }}>
              Data: Open Food Facts contributors · ODbL database / DbCL
              contents. Community records can be incomplete or out of date.{" "}
              {result.cached ? "Recent session cache" : "Retrieved"} ·{" "}
              {new Date(result.fetchedAt).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
              .
            </Copy>
            <Button
              secondary
              icon="open-outline"
              onPress={() =>
                Linking.openURL(p.sourceUrl).catch(() =>
                  setError("Could not open the source page."),
                )
              }
            >
              View source product
            </Button>
            <Button
              secondary
              onPress={() =>
                Linking.openURL(
                  "https://opendatacommons.org/licenses/odbl/1-0/",
                ).catch(() => setError("Could not open the data license."))
              }
            >
              Data license
            </Button>
          </Card>
        </>
      ) : !busy ? (
        <Notice>
          Scan a food barcode or enter its number. Some products have incomplete
          records or are not in the database. Product lookup does not use AI to
          invent missing values.
        </Notice>
      ) : null}
      <Button
        secondary
        onPress={() =>
          router.push({
            pathname: "/meal",
            params: { mode: mode === "template" ? "template" : "log" },
          })
        }
      >
        Enter food manually instead
      </Button>
    </Screen>
  );
}
