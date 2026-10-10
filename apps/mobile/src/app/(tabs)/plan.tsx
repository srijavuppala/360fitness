import { Text, View } from "react-native";
import { router } from "expo-router";
import { Button, Copy } from "../../components/ui";
import { MobileFrame, SettingsRow } from "../../components/MobileFrame";
import { useApp } from "../../data/store";
import { colors as c } from "../../theme";
export default function Plan() {
  const { state } = useApp();
  return (
    <MobileFrame
      bottomInset={false}
      header={
        <Text
          accessibilityRole="header"
          style={{
            fontSize: 28,
            fontWeight: "700",
            color: c.text,
            paddingVertical: 10,
          }}
        >
          My plan
        </Text>
      }
      footer={
        <Button
          icon="add"
          onPress={() =>
            router.push({ pathname: "/add", params: { mode: "template" } })
          }
        >
          Add a usual meal
        </Button>
      }
    >
      <SettingsRow
        title="Meal prep for the week"
        detail="Batch recipes · groceries · Gemini analysis"
        icon="calendar-outline"
        onPress={() => router.push("/prep")}
      />
      <Copy muted>Your go-to meals. Tap one to make it yours.</Copy>
      <View style={{ gap: 8 }}>
        {state.templates.map((meal) => (
          <SettingsRow
            key={meal.id}
            title={meal.name}
            detail={meal.slot}
            icon="restaurant-outline"
            onPress={() =>
              router.push({
                pathname: "/meal",
                params: { id: meal.id, mode: "template" },
              })
            }
          />
        ))}
      </View>
      {!state.templates.length ? (
        <Copy>Your plan is a clean slate. Add a meal you enjoy.</Copy>
      ) : null}
      <Copy muted style={{ fontSize: 12 }}>
        Your plan is a starting point. Editing it never changes meals you
        already confirmed.
      </Copy>
    </MobileFrame>
  );
}
