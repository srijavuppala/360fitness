import { useRef, useState } from "react";
import { Linking, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Button, Copy, Notice } from "./ui";

export function BarcodeCamera({
  onScan,
  onClose,
}: {
  onScan: (barcode: string) => void;
  onClose: () => void;
}) {
  const [permission, requestPermission] = useCameraPermissions();
  const [error, setError] = useState("");
  const scanned = useRef(false);
  if (!permission) return <Copy muted>Checking camera access…</Copy>;
  if (!permission.granted)
    return (
      <View style={{ gap: 12 }}>
        <Notice>
          Allow camera access to read the barcode. No photo or video is saved or
          uploaded. You can also type the number below.
        </Notice>
        <Button
          onPress={async () => {
            try {
              if (permission.canAskAgain) await requestPermission();
              else await Linking.openSettings();
            } catch {
              setError(
                "Camera access could not be opened. Enter the barcode manually.",
              );
            }
          }}
        >
          {permission.canAskAgain
            ? "Allow barcode camera"
            : "Open camera settings"}
        </Button>
        {error ? <Notice error>{error}</Notice> : null}
        <Button secondary onPress={onClose}>
          Enter barcode manually
        </Button>
      </View>
    );
  return (
    <View style={{ gap: 12 }}>
      {error ? (
        <Notice error>{error}</Notice>
      ) : (
        <View
          style={{
            height: 250,
            borderRadius: 20,
            overflow: "hidden",
            backgroundColor: "#17251C",
          }}
        >
          <CameraView
            style={{ flex: 1 }}
            facing="back"
            autofocus="on"
            barcodeScannerSettings={{
              barcodeTypes: ["ean13", "ean8", "upc_a", "itf14"],
            }}
            onMountError={() =>
              setError(
                "Camera could not start. Close it and enter the printed barcode.",
              )
            }
            onBarcodeScanned={({ data }) => {
              if (!scanned.current) {
                scanned.current = true;
                onScan(data);
              }
            }}
          />
        </View>
      )}
      <Copy muted>
        Center the product barcode in the camera. Keep the package still.
      </Copy>
      <Button secondary onPress={onClose}>
        Close camera
      </Button>
    </View>
  );
}
