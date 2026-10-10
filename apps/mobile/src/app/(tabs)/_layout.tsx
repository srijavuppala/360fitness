import { Redirect, Tabs } from "expo-router";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon, IconName } from "../../components/ui";
import { useApp } from "../../data/store";
import { colors as c } from "../../theme";

const icons: Record<string, IconName> = {
  today: "grid-outline",
  plan: "restaurant-outline",
  history: "bar-chart-outline",
  profile: "person-outline",
};
export default function TabLayout() {
  const { ready, state } = useApp();
  const insets = useSafeAreaInsets();
  const bottomPadding = Math.max(insets.bottom, 12);
  if (!ready || state.onboarding !== "complete") return <Redirect href="/" />;
  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: c.accent,
        tabBarInactiveTintColor: c.muted,
        tabBarStyle: {
          backgroundColor: c.background,
          borderTopColor: c.border,
          height: 64 + bottomPadding,
          paddingTop: 10,
          paddingBottom: bottomPadding,
        },
        tabBarLabelStyle: { fontSize: 10, fontWeight: "600" },
        tabBarIcon: ({ color, focused }) => (
          <View
            style={{
              width: 48,
              height: 32,
              borderRadius: 12,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: focused ? c.accentSoft : "transparent",
            }}
          >
            <Icon name={icons[route.name]} color={color} size={21} />
          </View>
        ),
      })}
    >
      <Tabs.Screen name="today" options={{ title: "Today" }} />
      <Tabs.Screen name="plan" options={{ title: "My Plan" }} />
      <Tabs.Screen name="history" options={{ title: "History" }} />
      <Tabs.Screen name="profile" options={{ title: "Profile" }} />
    </Tabs>
  );
}
