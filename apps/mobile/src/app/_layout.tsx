import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { AppProvider } from "../data/store";
import { colors } from "../theme";

export default function RootLayout() {
  return (
    <AppProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          animation: "slide_from_right",
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="meal" options={{ presentation: "modal" }} />
        <Stack.Screen name="add" options={{ presentation: "modal" }} />
      </Stack>
    </AppProvider>
  );
}
