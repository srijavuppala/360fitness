import { useCallback, useEffect, useRef, useState } from "react";
import { Image, Linking, Platform, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { LabelExtraction } from "../services/label-reader";
import {
  labelAiAvailable,
  LabelPhotoAsset,
  readPhotoLabel,
} from "../services/photo-label";
import * as ImagePicker from "expo-image-picker";
import { Button, Card, Copy, Icon, Notice } from "./ui";
import { colors as c } from "../theme";

export function LabelPhoto({
  onChange,
  onExtract,
}: {
  onChange: () => void;
  onExtract: (result: LabelExtraction) => void;
}) {
  const [photo, setPhoto] = useState<LabelPhotoAsset | null>(null);
  const [error, setError] = useState("");
  const [settings, setSettings] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reading, setReading] = useState(false);
  const [extraction, setExtraction] = useState<LabelExtraction | null>(null);
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
          if (alive.current) setError("Please choose your label photo again.");
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
        if (!alive.current) return;
        if (!permission.granted) {
          setError(
            "Camera access is off. Choose a photo or enter the label values below.",
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
          "Couldn’t open that photo. Try another image or enter the values below.",
        );
    } finally {
      locked.current = false;
      if (alive.current) setBusy(false);
    }
  }

  async function analyze() {
    if (!photo || readingLock.current || !labelAiAvailable) return;
    readingLock.current = true;
    setReading(true);
    setError("");
    setAnalysisNote("");
    setExtraction(null);
    const current = ++generation.current;
    const controller = new AbortController();
    request.current = controller;
    try {
      const result = await readPhotoLabel(photo, controller.signal);
      if (active.current && current === generation.current) {
        if (Object.values(result.fields).every((value) => value === ""))
          setError(
            "No readable nutrition values were found. Try a closer photo of the panel, or enter the values manually.",
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
      <Copy>{photo ? "Your label reference" : "Keep the label in view"}</Copy>
      <Copy muted style={{ fontSize: 13 }}>
        Take or choose a clear photo of the nutrition panel. It stays on this
        device until you choose “Read photo with AI”.
      </Copy>
      {photo ? (
        <>
          <Image
            source={{ uri: photo.uri }}
            accessibilityLabel="Selected nutrition label photo"
            resizeMode="contain"
            onError={() =>
              setError(
                "This photo can’t be displayed. Please choose a different image.",
              )
            }
            style={{
              width: "100%",
              height: expanded ? 600 : 240,
              borderRadius: 12,
              backgroundColor: c.surface,
            }}
          />
          <Button secondary onPress={() => setExpanded((value) => !value)}>
            {expanded ? "Smaller preview" : "Enlarge label"}
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
          Take label photo
        </Button>
      ) : null}
      <Button
        secondary
        icon="images-outline"
        disabled={busy}
        onPress={() => void pick(false)}
      >
        {photo ? "Replace photo" : "Choose label photo"}
      </Button>
      {photo ? (
        <>
          <Notice>
            Read photo with AI sends this photo to our server and Google Gemini.
            Your diary is not sent, and our server does not save the photo.
            Google processes it under its service terms. On phones, an anonymous
            Firebase session verifies the request.
          </Notice>
          <Button
            icon="sparkles-outline"
            busy={reading}
            disabled={!labelAiAvailable || busy}
            onPress={() => void analyze()}
          >
            {reading ? "Reading your label…" : "Read photo with AI"}
          </Button>
          {!labelAiAvailable ? (
            <Copy muted style={{ fontSize: 13 }}>
              AI setup is required for this build. You can still enter values
              below.
            </Copy>
          ) : null}
          {reading ? (
            <Button
              secondary
              onPress={() => {
                stopReading();
                setAnalysisNote("Cancelled. No extracted values were applied.");
              }}
            >
              Cancel analysis
            </Button>
          ) : null}
        </>
      ) : null}
      {extraction ? (
        <View
          style={{
            gap: 12,
            padding: 16,
            backgroundColor: c.surface,
            borderRadius: 16,
          }}
        >
          <Copy>Check what AI read</Copy>
          <Copy muted>
            {extraction.name ?? "Product name unread"} ·{" "}
            {extraction.basis === "100g"
              ? "per 100 g"
              : extraction.basis === "100ml"
                ? "per 100 ml"
                : extraction.basis === "serving"
                  ? "per serving"
                  : "basis unread"}
          </Copy>
          {extraction.servingDescription ? (
            <Copy muted>Printed serving: {extraction.servingDescription}</Copy>
          ) : null}
          <Copy>
            {extraction.fields.kcal || "—"}{" "}
            {extraction.energyUnit ?? "energy unit unread"} ·{" "}
            {extraction.fields.protein || "—"} g protein
          </Copy>
          <Copy>
            {extraction.fields.carbs || "—"} g carbs ·{" "}
            {extraction.fields.fat || "—"} g fat
          </Copy>
          <Copy muted style={{ fontSize: 13 }}>
            AI can misread labels. A dash means unknown. Using these values
            replaces your current nutrition fields; your portion must be entered
            again.
          </Copy>
          <Button
            onPress={() => {
              onExtract(extraction);
              setExtraction(null);
              setAnalysisNote(
                "AI values filled below. Check every field and choose the portion you ate.",
              );
            }}
          >
            Use extracted values
          </Button>
          <Button secondary onPress={() => setExtraction(null)}>
            Discard AI result
          </Button>
        </View>
      ) : null}
      {analysisNote ? <Notice>{analysisNote}</Notice> : null}
      {settings ? (
        <Button
          secondary
          onPress={() => {
            void Linking.openSettings().catch(() =>
              setError("Open your phone’s Settings to allow camera access."),
            );
          }}
        >
          Open camera settings
        </Button>
      ) : null}
      {error ? <Notice error>{error}</Notice> : null}
    </Card>
  );
}
