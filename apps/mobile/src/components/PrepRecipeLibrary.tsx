import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { prepRecipes, PrepRecipe } from "../domain/prep-recipes";
import { SettingsRow } from "./MobileFrame";
import { Button, Copy } from "./ui";
import { colors as c } from "../theme";

export function PrepRecipeLibrary({
  onChoose,
  onBack,
}: {
  onChoose(recipe: PrepRecipe): void;
  onBack(): void;
}) {
  const [category, setCategory] = useState<"Breakfast" | "Lunch">("Breakfast");
  return (
    <>
      <View style={{ gap: 6 }}>
        <Text style={{ color: c.text, fontSize: 26, fontWeight: "700" }}>
          A little prep. A simpler day.
        </Text>
        <Copy muted style={{ fontSize: 14 }}>
          Six easy starters with ready-to-eat ingredients. Choose one and make
          it yours.
        </Copy>
      </View>
      <View style={{ flexDirection: "row", gap: 8 }}>
        {(["Breakfast", "Lunch"] as const).map((item) => (
          <Pressable
            key={item}
            accessibilityRole="radio"
            accessibilityState={{ checked: category === item }}
            aria-checked={category === item}
            onPress={() => setCategory(item)}
            style={{
              flex: 1,
              minHeight: 48,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 14,
              backgroundColor: category === item ? c.accentSoft : "white",
            }}
          >
            <Text style={{ color: c.text, fontWeight: "600" }}>{item}</Text>
          </Pressable>
        ))}
      </View>
      {prepRecipes
        .filter((recipe) => recipe.category === category)
        .map((recipe) => (
          <SettingsRow
            key={recipe.id}
            title={recipe.name}
            detail={`About ${recipe.minutes} min · ${recipe.ingredients.length} ingredients`}
            icon="restaurant-outline"
            onPress={() => onChoose(recipe)}
          />
        ))}
      <Copy muted style={{ fontSize: 12 }}>
        Editable ideas, with nutrition left unknown. Review product labels for
        your dietary needs.
      </Copy>
      <Button secondary onPress={onBack}>
        Back to recipe choices
      </Button>
    </>
  );
}
