import { useCallback, useRef, useState } from "react";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Button, Header, Notice, Screen } from "../components/ui";
import { MealPhoto } from "../components/meal-photo";
import { useApp } from "../data/store";
import { mealPhotoDraft, MealPhotoResult } from "../domain/meal-photo";

export default function MealPhotoRoute() {
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const { setPendingMeal } = useApp();
  const [error, setError] = useState("");
  const navigating = useRef(false);
  useFocusEffect(
    useCallback(() => {
      navigating.current = false;
    }, []),
  );
  const changed = useCallback(() => {
    setError("");
    navigating.current = false;
  }, []);
  function review(result: MealPhotoResult) {
    if (navigating.current) return;
    try {
      const meal = mealPhotoDraft(result);
      setPendingMeal(meal);
      navigating.current = true;
      router.push({
        pathname: "/meal",
        params: {
          draft: meal.id,
          mode: mode === "template" ? "template" : "log",
        },
      });
    } catch {
      navigating.current = false;
      setError(
        "These foods could not be prepared for review. Try another photo or enter your meal manually.",
      );
    }
  }
  return (
    <Screen>
      <Header
        back
        eyebrow="Photo → review → confirm"
        title="What’s on your plate?"
        subtitle="Let AI suggest a starting point. You decide what goes into your diary."
      />
      <MealPhoto onChange={changed} onExtract={review} />
      {error ? <Notice error>{error}</Notice> : null}
      <Button
        secondary
        icon="create-outline"
        onPress={() =>
          router.push({
            pathname: "/meal",
            params: { mode: mode === "template" ? "template" : "log" },
          })
        }
      >
        Enter foods manually
      </Button>
      <Button
        secondary
        icon="document-text-outline"
        onPress={() =>
          router.push({
            pathname: "/label",
            params: { mode: mode === "template" ? "template" : "log" },
          })
        }
      >
        Read a nutrition label instead
      </Button>
    </Screen>
  );
}
