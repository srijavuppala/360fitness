import { useCallback, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { LabelPhoto } from "../components/label-photo";
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
} from "../components/ui";
import { useApp } from "../data/store";
import {
  emptyLabel,
  LabelBasis,
  LabelFields,
  labelMeal,
  labelPortion,
  readLabelText,
} from "../domain/label-entry";
import { formatProductValue } from "../domain/product-scan";
import { Nutrients } from "../domain/meals";
import type { LabelExtraction } from "../services/label-reader";
import { colors as c } from "../theme";

const labels: Record<keyof LabelFields, string> = {
  kcal: "Energy",
  protein: "Protein (g)",
  carbs: "Carbohydrates (g)",
  fat: "Total fat (g)",
};

export default function Label() {
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const { setPendingMeal } = useApp();
  const [name, setName] = useState("");
  const [fields, setFields] = useState<LabelFields>({ ...emptyLabel });
  const [energyUnit, setEnergyUnit] = useState<"kcal" | "kJ">("kcal");
  const [basis, setBasis] = useState<LabelBasis | null>(null);
  const [portion, setPortion] = useState("");
  const [text, setText] = useState("");
  const [textOpen, setTextOpen] = useState(false);
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState("");
  const [aiSource, setAiSource] = useState(false);
  const [aiNote, setAiNote] = useState("");
  const [importNote, setImportNote] = useState("");
  let preview: Nutrients | null = null;
  try {
    if (basis) preview = labelPortion(fields, energyUnit, basis, portion);
  } catch {
    /* Validate explicitly on review; don't interrupt typing. */
  }
  const unit = basis === "100g" ? "g" : basis === "100ml" ? "ml" : "servings";

  const changed = useCallback(() => {
    setChecked(false);
    setError("");
  }, []);
  const applyExtraction = useCallback((result: LabelExtraction) => {
    setFields(result.fields);
    setName(result.name ?? "");
    setEnergyUnit(result.energyUnit ?? "kcal");
    setBasis(result.basis);
    setPortion("");
    setAiSource(true);
    setAiNote(
      `AI-filled values need your review.${result.servingDescription ? ` Printed serving: ${result.servingDescription}.` : ""} Check the same column and units on your label.`,
    );
    setImportNote("");
    setChecked(false);
    setError("");
  }, []);
  function importText() {
    try {
      const result = readLabelText(text);
      setAiSource(false);
      setAiNote("");
      setFields(result.fields);
      setEnergyUnit(result.energyUnit);
      setBasis(null);
      setPortion("");
      changed();
      setImportNote(
        `${result.found} of 4 values filled. Unread values are blank. Choose the printed basis and check every value.`,
      );
    } catch (cause) {
      setError((cause as Error).message);
    }
  }
  function review() {
    try {
      if (!basis)
        throw new Error(
          "Choose whether the label values are per 100 g, per 100 ml, or per serving.",
        );
      const meal = labelMeal({
        name,
        fields,
        energyUnit,
        basis,
        portion,
        checked,
        source: aiSource ? "ai" : "manual",
      });
      setPendingMeal(meal);
      setError("");
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

  return (
    <Screen
      footer={
        <Button
          icon="arrow-forward"
          disabled={!checked || !name.trim() || !basis}
          onPress={review}
        >
          Review meal
        </Button>
      }
    >
      <Header
        back
        eyebrow="LABEL · PORTION · REVIEW"
        title="Let the label guide you."
        subtitle="For products without a barcode match, copy the facts from the package."
      />
      <LabelPhoto onChange={changed} onExtract={applyExtraction} />
      <Notice>
        Use AI to read a clear nutrition-label photo, or enter the values
        yourself. You review all values and your portion before anything is
        logged.
      </Notice>
      <Button
        secondary
        icon="document-text-outline"
        onPress={() => setTextOpen((value) => !value)}
      >
        {textOpen ? "Hide label text" : "Fill from label text"}
      </Button>
      {textOpen ? (
        <Card>
          <Copy>Paste one nutrition column</Copy>
          <Copy muted style={{ fontSize: 13 }}>
            English labels only. Use a separate line for Calories, Protein,
            Total Carbohydrate and Total Fat. This replaces the four fields
            below; unrecognized values stay blank.
          </Copy>
          <Field
            label="Nutrition label text"
            multiline
            maxLength={6000}
            value={text}
            onChangeText={setText}
            placeholder={
              "Calories 200\nTotal Fat 8 g\nTotal Carbohydrate 24 g\nProtein 6 g"
            }
            style={{ minHeight: 140, textAlignVertical: "top" }}
          />
          <Button secondary disabled={!text.trim()} onPress={importText}>
            Fill nutrition fields
          </Button>
          {importNote ? <Notice>{importNote}</Notice> : null}
        </Card>
      ) : null}
      {aiNote ? <Notice>{aiNote}</Notice> : null}
      <Section title="1. What does the label say?" />
      <Card>
        <Field
          label="Product name"
          value={name}
          maxLength={100}
          placeholder="e.g. Oat granola"
          onChangeText={(value) => {
            setName(value);
            changed();
          }}
        />
        <Copy muted>These values are printed per…</Copy>
        <Options
          value={basis}
          values={[
            ["100g", "100 g"],
            ["100ml", "100 ml"],
            ["serving", "Serving"],
          ]}
          onChange={(value) => {
            setBasis(value);
            setPortion("");
            changed();
          }}
        />
        <Copy muted style={{ fontSize: 13 }}>
          Use the same column for every value. Blank means unknown; enter 0 only
          when the label says zero.
        </Copy>
        <Options
          value={energyUnit}
          values={[
            ["kcal", "kcal / Calories"],
            ["kJ", "kJ"],
          ]}
          onChange={(value) => {
            setEnergyUnit(value);
            changed();
          }}
        />
        {(Object.keys(labels) as (keyof LabelFields)[]).map((key) => (
          <Field
            key={key}
            label={key === "kcal" ? `Energy (${energyUnit})` : labels[key]}
            keyboardType="decimal-pad"
            value={fields[key]}
            maxLength={10}
            placeholder="Unknown"
            onChangeText={(value) => {
              setFields((previous) => ({ ...previous, [key]: value }));
              changed();
            }}
          />
        ))}
      </Card>
      <Section title="2. How much did you have?" />
      <Card>
        <Field
          label={
            basis
              ? `Your portion (${unit})`
              : "Your portion (choose label basis first)"
          }
          value={portion}
          editable={!!basis}
          keyboardType="decimal-pad"
          maxLength={10}
          placeholder={basis === "serving" ? "e.g. 1.5" : "e.g. 30"}
          onChangeText={(value) => {
            setPortion(value);
            changed();
          }}
        />
        <Copy muted style={{ fontSize: 13 }}>
          {basis === "serving"
            ? "One serving means the serving size printed on this package, not the whole package."
            : "We scale the label’s values to this amount. Grams and milliliters aren’t interchangeable."}
        </Copy>
        {preview ? (
          <View style={{ gap: 8 }}>
            <Text style={{ color: c.accent, fontSize: 32, fontWeight: "600" }}>
              {formatProductValue(preview.kcal)}{" "}
              <Text style={{ fontSize: 15 }}>kcal</Text>
            </Text>
            <Copy muted>
              {formatProductValue(preview.protein)} g protein ·{" "}
              {formatProductValue(preview.carbs)} g carbs ·{" "}
              {formatProductValue(preview.fat)} g fat
            </Copy>
            <Copy muted style={{ fontSize: 12 }}>
              For your {portion} {unit} · not logged yet
            </Copy>
          </View>
        ) : (
          <Copy muted style={{ fontSize: 13 }}>
            Enter nutrition and a valid portion to see your totals.
          </Copy>
        )}
      </Card>
      <Pressable
        accessibilityRole="checkbox"
        aria-checked={checked}
        onPress={() => setChecked((value) => !value)}
        style={{
          flexDirection: "row",
          gap: 12,
          alignItems: "center",
          padding: 16,
          borderRadius: 16,
          backgroundColor: c.elevated,
        }}
      >
        <Icon name={checked ? "checkbox" : "square-outline"} color={c.accent} />
        <Copy style={{ flex: 1, fontSize: 13 }}>
          I checked the values, units and serving basis against the package.
        </Copy>
      </Pressable>
      {error ? <Notice error>{error}</Notice> : null}
      <Copy muted style={{ fontSize: 12 }}>
        This records nutrition you provide. It doesn’t assign a health score or
        assess allergens. Check the package’s ingredient and allergen
        statements.
      </Copy>
    </Screen>
  );
}

function Options<T extends string>({
  value,
  values,
  onChange,
}: {
  value: T | null;
  values: [T, string][];
  onChange: (value: T) => void;
}) {
  return (
    <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
      {values.map(([key, title]) => (
        <Pressable
          key={key}
          accessibilityRole="radio"
          accessibilityLabel={title}
          aria-checked={value === key}
          onPress={() => onChange(key)}
          style={{
            minHeight: 48,
            justifyContent: "center",
            paddingHorizontal: 16,
            paddingVertical: 12,
            borderRadius: 24,
            borderWidth: 1,
            borderColor: value === key ? c.accent : c.border,
            backgroundColor: value === key ? c.accentSoft : c.surface,
          }}
        >
          <Copy>{title}</Copy>
        </Pressable>
      ))}
    </View>
  );
}
