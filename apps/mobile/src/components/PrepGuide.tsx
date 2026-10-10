import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { PrepBatch } from "../domain/meal-prep";
import { Button, Copy, Icon } from "./ui";
import { SettingsRow } from "./MobileFrame";
import { colors as c } from "../theme";

export function PrepGuide({
  batch,
  saving,
  onAdvance,
  onBack,
}: {
  batch: PrepBatch;
  saving: boolean;
  onAdvance(step: number): void;
  onBack(): void;
}) {
  const [ingredients, setIngredients] = useState(false);
  const [page, setPage] = useState(0);
  const [reviewStep, setReviewStep] = useState<number | null>(null);
  const guide = batch.guide;
  if (!guide)
    return (
      <Button secondary onPress={onBack}>
        Back to batch
      </Button>
    );
  if (ingredients) {
    const pages = Math.ceil(batch.meal.foods.length / 4);
    return (
      <>
        <Copy>Amounts for the whole batch · {batch.servings} servings</Copy>
        {batch.meal.foods.slice(page * 4, page * 4 + 4).map((food) => (
          <View
            key={food.id}
            style={{
              padding: 14,
              borderRadius: 14,
              backgroundColor: "white",
              gap: 4,
            }}
          >
            <Text style={{ color: c.text, fontSize: 16 }}>{food.name}</Text>
            <Copy muted style={{ fontSize: 13 }}>
              {Number((food.quantity * batch.servings).toFixed(3))} {food.unit}
            </Copy>
          </View>
        ))}
        {pages > 1 ? (
          <View style={{ flexDirection: "row", gap: 8 }}>
            <View style={{ flex: 1 }}>
              <Button
                secondary
                disabled={page === 0}
                onPress={() => setPage(page - 1)}
              >
                Previous
              </Button>
            </View>
            <View style={{ flex: 1 }}>
              <Button
                secondary
                disabled={page >= pages - 1}
                onPress={() => setPage(page + 1)}
              >
                Next
              </Button>
            </View>
          </View>
        ) : null}
        <Button secondary onPress={() => setIngredients(false)}>
          Back to prep steps
        </Button>
      </>
    );
  }
  const step = Math.min(reviewStep ?? guide.completed, guide.completed);
  const done = step === guide.steps.length;
  return (
    <>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Copy muted>
            {batch.meal.name} · {batch.servings} servings
          </Copy>
        </View>
        {step > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Review previous prep step"
            onPress={() => setReviewStep(step - 1)}
            style={{
              minWidth: 48,
              minHeight: 48,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon name="chevron-back" />
          </Pressable>
        ) : null}
      </View>
      <View
        style={{
          padding: 18,
          borderRadius: 24,
          backgroundColor: c.accentSoft,
          gap: 12,
        }}
      >
        <Text
          accessibilityLiveRegion="polite"
          style={{ color: c.accent, fontWeight: "700", fontSize: 13 }}
        >
          {done
            ? "STEPS COMPLETE"
            : `STEP ${step + 1} OF ${guide.steps.length}${step < guide.completed ? " · DONE" : ""}`}
        </Text>
        <Text
          style={{
            color: c.text,
            fontSize: 20,
            fontWeight: "600",
            lineHeight: 27,
          }}
        >
          {done ? "Ready for the next few meals." : guide.steps[step]}
        </Text>
      </View>
      <SettingsRow
        title="Ingredients for this batch"
        detail="Scaled to your serving count"
        icon="list-outline"
        onPress={() => {
          setPage(0);
          setIngredients(true);
        }}
      />
      {done ? (
        <Copy muted>
          Return to your batch to mark it prepared. Food is logged only when you
          choose to log a serving.
        </Copy>
      ) : (
        <Button
          busy={saving}
          icon="checkmark"
          onPress={() => {
            if (step < guide.completed)
              setReviewStep(step + 1 < guide.completed ? step + 1 : null);
            else {
              setReviewStep(null);
              onAdvance(guide.completed);
            }
          }}
        >
          {step < guide.completed
            ? "Next step"
            : guide.completed === guide.steps.length - 1
              ? "Finish prep steps"
              : "Done, next step"}
        </Button>
      )}
      <Button secondary onPress={onBack}>
        {done ? "Back to batch" : "Pause & return to batch"}
      </Button>
      <Copy muted style={{ fontSize: 12 }}>
        Your completed steps are saved on this device.
      </Copy>
    </>
  );
}
