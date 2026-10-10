import { useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { Redirect, router } from "expo-router";
import { Button, Copy, Icon, Notice } from "../components/ui";
import { MobileFrame, SettingsRow } from "../components/MobileFrame";
import { useApp } from "../data/store";
import { colors as c } from "../theme";

export default function Welcome() {
  const { state, ready, update, saving } = useApp();
  const [error, setError] = useState("");
  const { height, width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const compact = height - insets.top - insets.bottom < 700;
  const heroSize = Math.min(compact ? 34 : 43, (width - 48) / 8.1);
  if (!ready) return <Redirect href="/" />;
  if (state.onboarding === "complete") return <Redirect href="/(tabs)/today" />;
  async function advance(step: "goals" | "routine" | "complete") {
    setError("");
    try {
      await update((previous) => ({ ...previous, onboarding: step }));
    } catch {
      setError("Couldn’t save on this device. Please try again.");
    }
  }
  if (state.onboarding === "goals") return <Redirect href="/preferences" />;
  if (state.onboarding === "routine")
    return (
      <MobileFrame
        header={
          <Text
            accessibilityRole="header"
            style={{
              color: c.text,
              fontSize: 26,
              fontWeight: "700",
              paddingVertical: 12,
            }}
          >
            You’re ready to begin.
          </Text>
        }
        footer={
          <Button
            busy={saving}
            onPress={() => advance("complete")}
            icon="arrow-forward"
          >
            Start my day
          </Button>
        }
      >
        <Copy muted>
          Start with sample meals. Tap to edit, or change them later in My Plan.
        </Copy>
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
        <Copy muted style={{ fontSize: 12 }}>
          Examples only, not a recommended eating plan. Nothing is logged until
          you confirm it.
        </Copy>
        {error ? <Notice error>{error}</Notice> : null}
        <SettingsRow
          title="Save my profile to an account"
          icon="cloud-outline"
          onPress={() => router.push("/account")}
        />
        <SettingsRow
          title="Review my profile"
          icon="options-outline"
          onPress={() => advance("goals")}
        />
      </MobileFrame>
    );
  return (
    <SafeAreaView style={s.safe}>
      <ScrollView bounces={false} contentContainerStyle={s.viewport}>
        <View style={[s.page, compact && { gap: 8 }]}>
          <View style={s.brand}>
            <View style={s.brandIcon}>
              <Icon name="aperture-outline" color={c.onAccent} size={26} />
            </View>
            <Text style={s.brandText}>
              360°
              <Text style={{ color: c.muted, fontWeight: "400" }}>
                {" "}
                FITNESS AI
              </Text>
            </Text>
          </View>
          <View style={[s.art, compact && { minHeight: 80, maxHeight: 190 }]}>
            <View style={[s.orbit, compact && { width: 132, height: 132 }]}>
              <View
                style={[s.innerOrbit, compact && { width: 96, height: 96 }]}
              >
                <Icon
                  name="leaf-outline"
                  color={c.accent}
                  size={compact ? 42 : 64}
                />
              </View>
            </View>
            <View style={[s.tag, { top: compact ? 4 : 20, left: 2 }]}>
              <View style={s.dot} />
              <Text style={s.tagText}>A routine that fits you</Text>
            </View>
            <View style={[s.tag, { bottom: compact ? 0 : 14, right: 0 }]}>
              <Icon name="checkmark-circle" color={c.accent} size={17} />
              <Text style={s.tagText}>A little progress, every day</Text>
            </View>
          </View>
          <Text
            style={[
              s.hero,
              { fontSize: heroSize, lineHeight: heroSize * 1.13 },
            ]}
          >
            Eat your way.{"\n"}
            <Text style={{ color: c.accent }}>Keep it simple.</Text>
          </Text>
          <Copy
            muted
            style={{
              fontSize: compact ? 14 : 16,
              lineHeight: compact ? 21 : 25,
            }}
          >
            Plan the meals you love. Check in with what actually happened. Make
            room for real life.
          </Copy>
          <View style={s.features}>
            <View style={s.feature}>
              <Icon name="restaurant-outline" color={c.accent} />
              <Copy muted style={{ fontSize: 11 }}>
                Your usual meals
              </Copy>
            </View>
            <View style={s.feature}>
              <Icon name="checkmark-done-outline" color={c.accent} />
              <Copy muted style={{ fontSize: 11 }}>
                Quick check-ins
              </Copy>
            </View>
            <View style={s.feature}>
              <Icon name="trending-up-outline" color={c.accent} />
              <Copy muted style={{ fontSize: 11 }}>
                Your own pace
              </Copy>
            </View>
          </View>
          {error ? <Notice error>{error}</Notice> : null}
          <View style={s.actions}>
            <Button
              onPress={() => advance("goals")}
              busy={saving}
              icon="arrow-forward"
            >
              {state.profileDraft ? "Continue my setup" : "Build my routine"}
            </Button>
            <Copy muted style={{ textAlign: "center", fontSize: 11 }}>
              Start on this device · Save to an account later
            </Copy>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.background },
  viewport: { flexGrow: 1, paddingHorizontal: 24, paddingVertical: 16 },
  page: {
    flex: 1,
    width: "100%",
    maxWidth: 560,
    alignSelf: "center",
    gap: 16,
    justifyContent: "space-between",
  },
  actions: { gap: 8, paddingTop: 6 },
  brand: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingTop: 0,
  },
  brandIcon: { backgroundColor: c.accent, borderRadius: 14, padding: 10 },
  brandText: {
    color: c.text,
    fontSize: 16,
    letterSpacing: 1.2,
    fontWeight: "700",
  },
  art: {
    flexGrow: 1,
    flexShrink: 1,
    minHeight: 180,
    maxHeight: 300,
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 0,
  },
  orbit: {
    width: 222,
    height: 222,
    borderRadius: 111,
    borderWidth: 1,
    borderColor: c.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: c.surface,
  },
  innerOrbit: {
    width: 162,
    height: 162,
    borderRadius: 81,
    borderWidth: 1,
    borderColor: c.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: c.accentSoft,
  },
  tag: {
    position: "absolute",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 13,
    paddingVertical: 7,
    backgroundColor: c.elevated,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: c.border,
  },
  tagText: { color: c.text, fontSize: 11 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: c.accent },
  hero: {
    color: c.text,
    fontSize: 43,
    lineHeight: 49,
    letterSpacing: -1.6,
    fontWeight: "600",
  },
  features: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  feature: { alignItems: "center", gap: 4 },
});
