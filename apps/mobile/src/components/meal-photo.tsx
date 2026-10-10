import { useCallback, useEffect, useRef, useState } from "react";
import { Image, Linking, Platform, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { MealPhotoResult } from "../domain/meal-photo";
import {
  mealPhotoAiAvailable,
  mealPhotoUsesAiLogic,
  readMealPhoto,
} from "../services/photo-meal";
import { formatValue } from "../domain/meals";
import { LabelPhotoAsset } from "../services/photo-label";
import * as ImagePicker from "expo-image-picker";
import { Button, Card, Copy, Icon, Notice } from "./ui";
import { colors as c } from "../theme";

export function MealPhoto({
  onChange,
  onExtract,
}: {
  onChange: () => void;
  onExtract: (result: MealPhotoResult) => void;
}) {
  const [photo, setPhoto] = useState<LabelPhotoAsset | null>(null);
  const [error, setError] = useState("");
  const [settings, setSettings] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reading, setReading] = useState(false);
  const [extraction, setExtraction] = useState<MealPhotoResult | null>(null);
  const [analysisNote, setAnalysisNote] = useState("");
  const request = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const active = useRef(true);
  const readingLock = useRef(false);
  const stopReading = useCallback(() => {
    generation.current++;
    request.current?.abort();
    readingLock.current = false;
    setReading(false);
    setExtraction(null);
    setAnalysisNote("");
  }, []);
  useFocusEffect(
    useCallback(() => {
      active.current = true;
      return () => {
        active.current = false;
        stopReading();
      };
    }, [stopReading]),
  );
  const alive = useRef(true);
  const locked = useRef(false);

  const accept = useCallback(
    (result: ImagePicker.ImagePickerResult) => {
      if (!alive.current || !active.current || result.canceled) return;
      const asset = result.assets[0];
      if (
        !asset ||
        (asset.fileSize ?? 0) > 10 * 1024 * 1024 ||
        asset.width * asset.height > 48_000_000
      ) {
        setError("Choose a smaller photo: up to 10 MB and 48 megapixels.");
        return;
      }
      stopReading();
      setPhoto({ uri: asset.uri, width: asset.width, height: asset.height });
      setExpanded(false);
      setError("");
      onChange();
    },
    [onChange, stopReading],
  );

  useEffect(() => {
    alive.current = true;
    if (Platform.OS === "android") {
      void ImagePicker.getPendingResultAsync()
        .then((result) => {
          if (result && "canceled" in result) accept(result);
          else if (result && alive.current)
            setError(
              "The photo could not be recovered. Please choose it again.",
            );
        })
        .catch(() => {
          if (alive.current) setError("Please choose your meal photo again.");
        });
    }
    return () => {
      alive.current = false;
    };
  }, [accept]);

  async function pick(camera: boolean) {
    if (locked.current) return;
    // Web pickers don't reliably resolve cancellation; never leave the UI locked there.
    if (Platform.OS !== "web") {
      locked.current = true;
      setBusy(true);
    }
    stopReading();
    setError("");
    setSettings(false);
    try {
      if (camera && Platform.OS !== "web") {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!alive.current || !active.current) return;
        if (!permission.granted) {
          setError(
            "Camera access is off. Choose a photo or enter foods manually.",
          );
          setSettings(!permission.canAskAgain);
          return;
        }
      }
      const options: ImagePicker.ImagePickerOptions = {
        mediaTypes: ["images"],
        quality: 0.8,
        exif: false,
        base64: false,
        allowsMultipleSelection: false,
      };
      const result = camera
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);
      accept(result);
    } catch {
      if (alive.current)
        setError(
          "Couldn’t open that photo. Try another image or enter foods manually.",
        );
    } finally {
      locked.current = false;
      if (alive.current) setBusy(false);
    }
  }

  async function analyze() {
    if (!photo || readingLock.current || !mealPhotoAiAvailable) return;
    readingLock.current = true;
    setReading(true);
    setError("");
    setAnalysisNote("");
    setExtraction(null);
    const current = ++generation.current;
    const controller = new AbortController();
    request.current = controller;
    try {
      const result = await readMealPhoto(photo, controller.signal);
      if (active.current && current === generation.current) {
        if (result.status !== "food")
          setError(
            result.status === "no_food"
              ? "No meal was found in this photo. Choose a meal photo, use the label reader, or enter foods manually."
              : "This meal is too unclear to identify. Try a brighter, closer photo of the whole plate or enter foods manually.",
          );
        else setExtraction(result);
      }
    } catch (cause) {
      if (active.current && current === generation.current)
        setError(
          cause instanceof Error
            ? cause.message
            : "Photo analysis failed. Please try again.",
        );
    } finally {
      if (current === generation.current) {
        readingLock.current = false;
        setReading(false);
      }
    }
  }

  return (
    <Card style={{ backgroundColor: c.accentSoft }}>
      <Icon name="camera-outline" size={30} color={c.accent} />
      <Copy>
        {photo ? "Your meal photo" : "Start with a photo of your plate"}
      </Copy>
      <Copy muted style={{ fontSize: 13 }}>
        Include the whole meal in good light. A photo can suggest foods, but
        portions and nutrition are estimates you will need to check.
      </Copy>
      {photo ? (
        <>
          <Image
            source={{ uri: photo.uri }}
            accessibilityLabel="Selected meal photo"
            resizeMode="contain"
            onError={() =>
              setError("This photo can’t be displayed. Choose another image.")
            }
            style={{
              width: "100%",
              height: expanded ? 480 : 240,
              borderRadius: 12,
              backgroundColor: c.surface,
            }}
          />
          <Button secondary onPress={() => setExpanded((value) => !value)}>
            {expanded ? "Smaller preview" : "Enlarge photo"}
          </Button>
          <Button
            secondary
            onPress={() => {
              stopReading();
              setPhoto(null);
              setError("");
              onChange();
            }}
          >
            Remove photo
          </Button>
        </>
      ) : null}
      {Platform.OS !== "web" ? (
        <Button
          icon="camera-outline"
          busy={busy}
          onPress={() => void pick(true)}
        >
          Take meal photo
        </Button>
      ) : null}
      <Button
        secondary
        icon="images-outline"
        disabled={busy}
        onPress={() => void pick(false)}
      >
        {photo ? "Replace photo" : "Choose meal photo"}
      </Button>
      {photo ? (
        <>
          <Notice>
            {mealPhotoUsesAiLogic
              ? "Analyze meal photo sends this image to Google Gemini through Firebase AI Logic. Your profile and diary are not sent, and this app does not store the photo; Google processes it under its service terms."
              : "Analyze meal photo sends this image to our server and Google Gemini. Your profile and diary are not sent. Our server does not save the photo; Google processes it under its service terms. Phones use an anonymous Firebase session to verify the request."}
          </Notice>
          <Button
            icon="sparkles-outline"
            busy={reading}
            disabled={!mealPhotoAiAvailable || busy}
            onPress={() => void analyze()}
          >
            {reading ? "Looking at your meal…" : "Analyze meal photo"}
          </Button>
          {!mealPhotoAiAvailable ? (
            <Copy muted>
              Photo AI needs setup for this build. You can still enter foods
              manually.
            </Copy>
          ) : null}
          {reading ? (
            <Button
              secondary
              onPress={() => {
                stopReading();
                setAnalysisNote("Cancelled. No foods were applied.");
              }}
            >
              Cancel analysis
            </Button>
          ) : null}
        </>
      ) : (
        <Copy muted style={{ fontSize: 12 }}>
          Your photo stays on this device until you choose Analyze meal photo.
        </Copy>
      )}
      {extraction ? (
        <View style={{ gap: 12 }}>
          <Copy>Check the suggested foods</Copy>
          <Notice>
            Photos cannot reveal every ingredient or measure portions precisely.
            These suggestions cannot establish allergy safety. Nothing has been
            logged.
          </Notice>
          {extraction.foods.map((food, index) => (
            <Card key={index}>
              <Copy>{food.name}</Copy>
              <Copy muted>
                {food.quantity === null
                  ? "Portion unknown — enter the amount you ate"
                  : `${food.quantity} ${food.unit} · suggested portion`}
              </Copy>
              <Copy>
                {formatValue(food.nutrition.kcal)} kcal ·{" "}
                {formatValue(food.nutrition.protein)} g protein
              </Copy>
              <Copy muted style={{ fontSize: 12 }}>
                {food.uncertain ? "Needs a closer check. " : ""}
                {food.portionNote}
              </Copy>
            </Card>
          ))}
          <Button onPress={() => onExtract(extraction)} icon="arrow-forward">
            Review foods and portions
          </Button>
          <Button secondary onPress={() => setExtraction(null)}>
            Discard suggestions
          </Button>
        </View>
      ) : null}
      {analysisNote ? <Notice>{analysisNote}</Notice> : null}
      {settings ? (
        <Button
          secondary
          onPress={() =>
            void Linking.openSettings().catch(() =>
              setError("Open your phone’s Settings to allow camera access."),
            )
          }
        >
          Open camera settings
        </Button>
      ) : null}
      {error ? <Notice error>{error}</Notice> : null}
    </Card>
  );
}
