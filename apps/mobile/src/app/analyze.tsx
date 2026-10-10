import { useState } from "react";
import { Text } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import {
  Button,
  Card,
  Copy,
  DemoBanner,
  Field,
  Header,
  Notice,
  Screen,
} from "../components/ui";
import { generateMealPrompt, parseMealEstimate } from "../domain/mealAnalysis";
import { useApp } from "../data/store";
import { colors as c } from "../theme";

export default function Analyze() {
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const { setPendingMeal } = useApp();
  const [description, setDescription] = useState("");
  const [response, setResponse] = useState("");
  const [prompt, setPrompt] = useState("");
  const [error, setError] = useState("");
  function review() {
    try {
      const meal = parseMealEstimate(
        response,
        description.trim().slice(0, 100),
      );
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
      setError(
        cause instanceof Error ? cause.message : "Couldn’t open that estimate.",
      );
    }
  }
  return (
    <Screen>
      <DemoBanner />
      <Header
        back
        eyebrow="Describe · Review · Confirm"
        title="Start with an estimate."
        subtitle="Use your own AI assistant to draft a meal, then make it yours."
      />
      <Notice>
        Automatic AI analysis isn’t connected yet. Nothing is sent from this
        screen. You choose whether to share your description with an assistant.
      </Notice>
      <Card>
        <Field
          label="Meal description"
          placeholder="e.g. Two eggs and a slice of toast"
          value={description}
          maxLength={500}
          multiline
          onChangeText={(text) => {
            setDescription(text);
            setPrompt("");
          }}
        />
        <Button
          secondary
          disabled={!description.trim()}
          onPress={() => {
            try {
              setPrompt(generateMealPrompt(description));
              setError("");
            } catch (cause) {
              setError((cause as Error).message);
            }
          }}
        >
          Prepare a prompt
        </Button>
        {prompt ? (
          <>
            <Copy muted>
              Select and copy this prompt into your AI assistant.
            </Copy>
            <Text
              selectable
              style={{ color: c.text, fontSize: 13, lineHeight: 20 }}
            >
              {prompt}
            </Text>
          </>
        ) : null}
      </Card>
      <Card>
        <Copy>Already have an estimate?</Copy>
        <Copy muted style={{ fontSize: 13 }}>
          Paste the JSON response below. We’ll check its format and let you edit
          the foods before anything is logged.
        </Copy>
        <Field
          label="AI estimate response"
          placeholder="Paste the complete JSON response"
          multiline
          value={response}
          maxLength={30001}
          onChangeText={setResponse}
          style={{ minHeight: 140, textAlignVertical: "top" }}
        />
        <Button
          disabled={!description.trim() || !response.trim()}
          onPress={review}
        >
          Review estimate
        </Button>
      </Card>
      {error ? <Notice error>{error}</Notice> : null}
    </Screen>
  );
}
