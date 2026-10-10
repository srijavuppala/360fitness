import { Redirect } from "expo-router";
import { useApp } from "../data/store";
import { Button, Copy, Header, Notice, Screen } from "../components/ui";

export default function Index() {
  const { ready, state, error, retry } = useApp();
  if (!ready)
    return (
      <Screen>
        <Header eyebrow="360° Fitness AI" title="A little better, every day." />
        {error ? (
          <>
            <Notice error>{error}</Notice>
            <Button onPress={retry}>Try again</Button>
          </>
        ) : (
          <Copy muted>Opening your routine…</Copy>
        )}
      </Screen>
    );
  return (
    <Redirect
      href={state.onboarding === "complete" ? "/(tabs)/today" : "/welcome"}
    />
  );
}
