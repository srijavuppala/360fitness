// Adapted from AtharvaK51/CalorieTracker components/ChartCard.tsx (MIT).
// Copyright (c) 2026 AtharvaK51. See licenses/CalorieTracker-MIT.txt.
import { PropsWithChildren } from "react";
import { Text } from "react-native";
import { Card, styles } from "./ui";

export function ChartCard({
  title,
  children,
}: PropsWithChildren<{ title: string }>) {
  return (
    <Card>
      <Text style={styles.section}>{title}</Text>
      {children}
    </Card>
  );
}
