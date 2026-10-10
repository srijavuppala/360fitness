import { useState } from "react";
import { View } from "react-native";
import { Food, newId, Nutrients, nutrientKeys } from "../domain/meals";
import { Button, Card, Copy, Field, Notice, styles } from "./ui";

export function FoodForm({
  initial,
  onAdd,
  onCancel,
}: {
  initial?: Food;
  onAdd: (food: Food) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [quantity, setQuantity] = useState(String(initial?.quantity ?? 1));
  const [unit, setUnit] = useState(initial?.unit ?? "serving");
  const [values, setValues] = useState({
    kcal: initial?.nutrition.kcal?.toString() ?? "",
    protein: initial?.nutrition.protein?.toString() ?? "",
    carbs: initial?.nutrition.carbs?.toString() ?? "",
    fat: initial?.nutrition.fat?.toString() ?? "",
  });
  const [error, setError] = useState("");
  function add() {
    const amount = Number(quantity);
    const nutrition = Object.fromEntries(
      nutrientKeys.map((key) => [
        key,
        values[key].trim() === "" ? null : Number(values[key]),
      ]),
    ) as Nutrients;
    if (
      !name.trim() ||
      !unit.trim() ||
      !Number.isFinite(amount) ||
      amount <= 0 ||
      amount > 10000
    ) {
      setError(
        "Add a food name, serving unit and a quantity greater than zero (up to 10,000).",
      );
      return;
    }
    if (
      nutrientKeys.some(
        (key) =>
          nutrition[key] !== null &&
          (!Number.isFinite(nutrition[key]) ||
            nutrition[key]! < 0 ||
            nutrition[key]! > 10000),
      )
    ) {
      setError(
        "Use nonnegative nutrition values up to 10,000, or leave them blank.",
      );
      return;
    }
    onAdd({
      id: initial?.id ?? newId(),
      name: name.trim(),
      quantity: amount,
      unit: unit.trim(),
      nutrition,
      source: initial?.source ?? "manual",
      ...(initial?.estimateNote ? { estimateNote: initial.estimateNote } : {}),
      ...(initial?.sourceBarcode
        ? { sourceBarcode: initial.sourceBarcode }
        : {}),
    });
  }
  return (
    <Card>
      <Copy>{initial ? "Edit food" : "Add a food"}</Copy>
      <Field
        label="Food name"
        value={name}
        onChangeText={setName}
        placeholder="e.g. Wholegrain toast"
        maxLength={80}
      />
      <View style={styles.row}>
        <Field
          label="Quantity"
          value={quantity}
          onChangeText={setQuantity}
          keyboardType="decimal-pad"
        />
        <Field
          label="Unit"
          value={unit}
          onChangeText={setUnit}
          maxLength={24}
        />
      </View>
      <Copy muted style={{ fontSize: 12 }}>
        Nutrition for this entire quantity. Use the food label, or leave unknown
        values blank.
      </Copy>
      <View style={styles.row}>
        {(["kcal", "protein"] as const).map((key) => (
          <Field
            key={key}
            label={key === "kcal" ? "Calories (kcal)" : "Protein (g)"}
            value={values[key]}
            onChangeText={(value) =>
              setValues((previous) => ({ ...previous, [key]: value }))
            }
            keyboardType="decimal-pad"
            placeholder="Unknown"
          />
        ))}
      </View>
      <View style={styles.row}>
        {(["carbs", "fat"] as const).map((key) => (
          <Field
            key={key}
            label={key === "carbs" ? "Carbs (g)" : "Fat (g)"}
            value={values[key]}
            onChangeText={(value) =>
              setValues((previous) => ({ ...previous, [key]: value }))
            }
            keyboardType="decimal-pad"
            placeholder="Unknown"
          />
        ))}
      </View>
      {error ? <Notice error>{error}</Notice> : null}
      <Button onPress={add} icon="add">
        {initial ? "Save food changes" : "Add food"}
      </Button>
      <Button secondary onPress={onCancel}>
        Cancel
      </Button>
    </Card>
  );
}
