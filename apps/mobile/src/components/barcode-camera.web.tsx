import { View } from "react-native";
import { Button, Notice } from "./ui";
export function BarcodeCamera({
  onClose,
}: {
  onScan: (barcode: string) => void;
  onClose: () => void;
}) {
  return (
    <View style={{ gap: 12 }}>
      <Notice>
        Camera scanning is available in the iPhone and Android app. In this
        browser preview, enter the printed barcode below.
      </Notice>
      <Button secondary onPress={onClose}>
        Use printed barcode
      </Button>
    </View>
  );
}
