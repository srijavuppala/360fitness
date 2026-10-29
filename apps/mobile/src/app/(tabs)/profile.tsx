import { useState } from "react";
import { Share, Text, View } from "react-native";
import { router } from "expo-router";
import { Button, Copy, Icon, Notice } from "../../components/ui";
import {
  DetailSheet,
  MobileFrame,
  SettingsRow,
} from "../../components/MobileFrame";
import { useApp } from "../../data/store";
import { initialState } from "../../domain/fixtures";
import { answerLabel, goalLabels } from "../../domain/profile";
import { calculateTargets, directionLabel } from "../../domain/targets";
import { calorieTrackerNotice } from "../../domain/thirdPartyNotices";
import { colors as c } from "../../theme";

export default function Profile() {
  const { state, update, saving } = useApp();
  const [sheet, setSheet] = useState<
    | "Data & privacy"
    | "Your data"
    | "Reset local data"
    | "About this app"
    | "Open-source credits"
    | null
  >(null);
  const [message, setMessage] = useState("");
  const targets = state.profile
    ? calculateTargets(state.profile.answers)
    : null;
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
          Profile
        </Text>
      }
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 14,
          paddingVertical: 12,
        }}
      >
        <View
          style={{
            padding: 18,
            borderRadius: 30,
            backgroundColor: c.accentSoft,
          }}
        >
          <Icon name="person-outline" color={c.accent} size={28} />
        </View>
        <View style={{ flex: 1, gap: 5 }}>
          <Text style={{ color: c.text, fontSize: 20, fontWeight: "700" }}>
            Your personal space
          </Text>
          <Copy muted style={{ fontSize: 12 }}>
            Meals and preferences on this device
          </Copy>
        </View>
      </View>
      <View
        style={{
          padding: 18,
          borderRadius: 20,
          backgroundColor: c.accentSoft,
          gap: 10,
        }}
      >
        <Text
          style={{
            color: c.accent,
            fontSize: 10,
            fontWeight: "700",
            letterSpacing: 1,
          }}
        >
          YOUR FOCUS
        </Text>
        <Text style={{ color: c.text, fontSize: 20, fontWeight: "600" }}>
          {state.profile
            ? answerLabel(state.profile.answers, "primaryGoal")
            : goalLabels[state.goal]}
        </Text>
        {targets ? (
          <Copy muted>
            {targets.kcal.toLocaleString("en-US")} kcal a day ·{" "}
            {directionLabel(targets)}. Estimate, not medical advice.
          </Copy>
        ) : null}
        <Button
          icon="options-outline"
          onPress={() => router.push("/preferences")}
        >
          {state.profileDraft
            ? "Continue profile setup"
            : state.profile
              ? "Edit my profile"
              : "Set up my profile"}
        </Button>
      </View>
      <View style={{ gap: 6 }}>
        <SettingsRow
          title="Account & backup"
          detail="Sign in · save or restore your profile"
          icon="cloud-outline"
          onPress={() => router.push("/account")}
        />
        <SettingsRow
          title="Data & privacy"
          detail="Your data, export and local reset"
          icon="shield-checkmark-outline"
          onPress={() => setSheet("Data & privacy")}
        />
        <SettingsRow
          title="About this app"
          detail="Available features & credits"
          icon="information-circle-outline"
          onPress={() => setSheet("About this app")}
        />
      </View>
      <Text
        style={{
          color: c.muted,
          fontSize: 11,
          textAlign: "center",
          marginTop: "auto",
          paddingTop: 12,
        }}
      >
        360° Fitness AI · Foundation build
      </Text>
      <DetailSheet
        visible={sheet !== null}
        title={sheet ?? "Details"}
        onClose={() => {
          setSheet(null);
          setMessage("");
        }}
      >
        {sheet === "Data & privacy" ? (
          <>
            <Copy>
              Meals and profile drafts stay on this device. In Account & backup,
              you can choose to save or restore a profile using your account.
              Meal prep has its own optional cloud backup in My Plan.
            </Copy>
            <Copy muted>
              Barcode lookup sends the product number to Open Food Facts. Photo
              analysis sends a photo only after you confirm the upload. Check
              the package for current ingredients and allergens.
            </Copy>
            <SettingsRow
              title="View & export my data"
              icon="document-text-outline"
              onPress={() => setSheet("Your data")}
            />
            <SettingsRow
              title="Reset local data"
              danger
              icon="refresh-outline"
              onPress={() => setSheet("Reset local data")}
            />
          </>
        ) : sheet === "Your data" ? (
          <>
            <Copy muted>
              Your preferences, templates and check-ins as versioned JSON.
            </Copy>
            <Button
              secondary
              onPress={() =>
                void Share.share({
                  message: JSON.stringify(state, null, 2),
                  title: "360° Fitness data",
                }).catch(() =>
                  setMessage(
                    "Sharing isn’t available here. Select and copy the data below.",
                  ),
                )
              }
            >
              Share data
            </Button>
            <Text
              selectable
              style={{ fontSize: 12, color: c.muted, lineHeight: 18 }}
            >
              {JSON.stringify(state, null, 2)}
            </Text>
          </>
        ) : sheet === "Reset local data" ? (
          <>
            <Notice>
              This clears the meals, check-ins and preferences on this device.
              It cannot be undone. A cloud profile is not deleted.
            </Notice>
            <Button
              busy={saving}
              onPress={() =>
                void update(() => initialState())
                  .then(() => setSheet(null))
                  .catch(() =>
                    setMessage("Couldn’t clear local data. Please try again."),
                  )
              }
            >
              Clear local data and start again
            </Button>
            <Button secondary onPress={() => setSheet("Data & privacy")}>
              Keep my data
            </Button>
          </>
        ) : sheet === "About this app" ? (
          <>
            <Copy>
              Track your usual meals, check in, scan barcodes and review
              nutrition estimates. AI photo analysis requires a configured
              server and compatible build.
            </Copy>
            <Copy muted>
              Profile and meal-prep backup require Firebase configuration.
              Meal-history sync, tailored recommendations, automatic reminders
              and wearable connections are not active yet. Voice entry uses your
              keyboard in Expo Go; the dedicated microphone requires a
              development build.
            </Copy>
            <SettingsRow
              title="Open-source credits"
              onPress={() => setSheet("Open-source credits")}
            />
          </>
        ) : sheet === "Open-source credits" ? (
          <Text
            selectable
            style={{ color: c.muted, fontSize: 12, lineHeight: 19 }}
          >
            {calorieTrackerNotice}
          </Text>
        ) : null}
        {message ? <Notice error>{message}</Notice> : null}
      </DetailSheet>
    </MobileFrame>
  );
}
