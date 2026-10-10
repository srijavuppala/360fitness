import { Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import {
  Button,
  Card,
  Copy,
  DemoBanner,
  Header,
  Icon,
  Screen,
} from "../components/ui";
import { colors as c } from "../theme";
export default function Saved() {
  const { status, date } = useLocalSearchParams<{
    status?: string;
    date?: string;
  }>();
  return (
    <Screen
      footer={
        <>
          <Button onPress={() => router.replace("/(tabs)/today")}>
            Back to Today
          </Button>
          <Button secondary onPress={() => router.replace("/(tabs)/history")}>
            See my week
          </Button>
        </>
      }
    >
      <DemoBanner />
      <View style={{ alignItems: "center", paddingTop: 45, paddingBottom: 25 }}>
        <View
          style={{
            padding: 30,
            backgroundColor: c.accentSoft,
            borderRadius: 100,
          }}
        >
          <Icon name="checkmark" color={c.accent} size={56} />
        </View>
      </View>
      <Header
        eyebrow="One less thing to think about"
        title="You’re all set."
        subtitle={
          status === "skipped"
            ? "Meal marked as skipped. No nutrition added."
            : "Your meal is recorded. Carry on with your day."
        }
      />
      <Card>
        <Text style={{ color: c.accent, fontSize: 20, fontWeight: "600" }}>
          Saved on this device
        </Text>
        <Copy muted>
          This is a local demo check-in for {date}. It will still be here when
          you reopen the app on this device. Cloud sync is not connected yet.
        </Copy>
      </Card>
    </Screen>
  );
}
