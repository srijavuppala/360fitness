import { router, useLocalSearchParams } from "expo-router";
import {
  Button,
  Card,
  Copy,
  DemoBanner,
  Header,
  Icon,
  Notice,
  Screen,
} from "../components/ui";
import { colors as c } from "../theme";
export default function Add() {
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  return (
    <Screen>
      <DemoBanner />
      <Header
        back
        eyebrow="Make room for something different"
        title={mode === "template" ? "Add a usual meal." : "What did you eat?"}
        subtitle="However your day goes, you can make it your own."
      />
      <Card>
        <Icon name="search-outline" color={c.accent} size={30} />
        <Copy>Search foods</Copy>
        <Copy muted>
          Find foods by name or brand, or add one you’ve logged before. Review
          portions before logging.
        </Copy>
        <Button
          icon="search"
          onPress={() =>
            router.push({
              pathname: "/search",
              params: { mode: mode === "template" ? "template" : "log" },
            })
          }
        >
          Search foods
        </Button>
      </Card>
      <Card>
        <Icon name="sparkles-outline" color={c.accent} size={30} />
        <Copy>Start with a meal photo</Copy>
        <Copy muted>
          Get suggested foods and portions from a photo. Review and correct
          every estimate before logging.
        </Copy>
        <Button
          icon="camera-outline"
          onPress={() =>
            router.push({
              pathname: "/meal-photo",
              params: { mode: mode === "template" ? "template" : "log" },
            })
          }
        >
          Scan a meal photo
        </Button>
      </Card>
      <Card>
        <Icon name="barcode-outline" color={c.accent} size={30} />
        <Copy>Scan a packaged food</Copy>
        <Copy muted>
          Look up nutrition, ingredients and reported allergens. Check the
          package, then choose your portion.
        </Copy>
        <Button
          icon="scan-outline"
          onPress={() =>
            router.push({
              pathname: "/scan",
              params: { mode: mode === "template" ? "template" : "log" },
            })
          }
        >
          Scan a product
        </Button>
      </Card>
      <Card>
        <Icon name="camera-outline" color={c.accent} size={30} />
        <Copy>Use the nutrition label</Copy>
        <Copy muted>
          Read a label photo with AI, check the extracted values, and calculate
          the portion you ate. Manual entry is always available.
        </Copy>
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
          Read a label
        </Button>
      </Card>
      <Card>
        <Icon name="create-outline" color={c.accent} size={30} />
        <Copy>Build it yourself</Copy>
        <Copy muted>
          Add foods and portions, using nutrition from a label or your own
          estimate.
        </Copy>
        <Button
          icon="add"
          onPress={() =>
            router.push({
              pathname: "/meal",
              params: { mode: mode === "template" ? "template" : "log" },
            })
          }
        >
          Enter a meal manually
        </Button>
      </Card>
      <Card>
        <Icon name="chatbubble-ellipses-outline" color={c.accent} />
        <Copy>Describe your meal</Copy>
        <Copy muted style={{ fontSize: 13 }}>
          Bring an estimate from your AI assistant, then review the foods and
          portions before saving. Automatic analysis is not connected yet.
        </Copy>
        <Button
          secondary
          onPress={() =>
            router.push({
              pathname: "/analyze",
              params: { mode: mode === "template" ? "template" : "log" },
            })
          }
        >
          Import a meal estimate
        </Button>
      </Card>
      <Notice>
        You can always log manually, even when AI isn’t available.
      </Notice>
    </Screen>
  );
}
