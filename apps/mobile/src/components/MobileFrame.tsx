import { PropsWithChildren, ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Icon, IconName } from "./ui";
import { colors as c } from "../theme";

/** Fixed navigation and action areas; overflow remains available for large text/keyboard. */
export function MobileFrame({
  children,
  header,
  footer,
  bottomInset = true,
}: PropsWithChildren<{
  header?: ReactNode;
  footer?: ReactNode;
  bottomInset?: boolean;
}>) {
  return (
    <SafeAreaView
      style={s.safe}
      edges={
        bottomInset
          ? ["top", "left", "right", "bottom"]
          : ["top", "left", "right"]
      }
    >
      <KeyboardAvoidingView
        style={s.safe}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {header ? <View style={s.header}>{header}</View> : null}
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={s.content}
        >
          <View style={s.inner}>{children}</View>
        </ScrollView>
        {footer ? <View style={s.footer}>{footer}</View> : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
export function DetailSheet({
  title,
  visible,
  onClose,
  children,
}: PropsWithChildren<{ title: string; visible: boolean; onClose(): void }>) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <MobileFrame
        header={
          <View style={s.row}>
            <Text accessibilityRole="header" style={s.sheetTitle}>
              {title}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Close ${title}`}
              onPress={onClose}
              style={s.close}
            >
              <Icon name="close" />
            </Pressable>
          </View>
        }
      >
        {children}
      </MobileFrame>
    </Modal>
  );
}
export function SettingsRow({
  title,
  detail,
  icon,
  onPress,
  danger = false,
  disabled = false,
}: {
  title: string;
  detail?: string;
  icon?: IconName;
  onPress(): void;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        s.setting,
        pressed && { opacity: 0.65 },
        disabled && { opacity: 0.4 },
      ]}
    >
      {icon ? (
        <View style={s.icon}>
          <Icon name={icon} color={danger ? c.danger : c.accent} size={20} />
        </View>
      ) : null}
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={[s.rowTitle, danger && { color: c.danger }]}>{title}</Text>
        {detail ? (
          <Text numberOfLines={1} style={s.detail}>
            {detail}
          </Text>
        ) : null}
      </View>
      <Icon name="chevron-forward" color={c.muted} size={17} />
    </Pressable>
  );
}
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.background },
  header: {
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 10,
    width: "100%",
    maxWidth: 560,
    alignSelf: "center",
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  },
  inner: {
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
    gap: 16,
    flexGrow: 1,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 12,
    gap: 8,
    width: "100%",
    maxWidth: 560,
    alignSelf: "center",
  },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  sheetTitle: { fontSize: 21, fontWeight: "700", color: c.text, flex: 1 },
  close: {
    minWidth: 48,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 24,
    backgroundColor: c.accentSoft,
  },
  setting: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 62,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: "white",
    borderRadius: 16,
  },
  icon: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: c.background,
    borderRadius: 10,
  },
  rowTitle: { color: c.text, fontSize: 15, fontWeight: "600" },
  detail: { color: c.muted, fontSize: 12 },
});
