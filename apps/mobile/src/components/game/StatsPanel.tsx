import { StyleSheet, Text, View } from "react-native";
import type { GameState } from "@talebound/shared";

interface Props {
  gameState: GameState;
  campaignTitle: string;
}

/**
 * Top status bar showing HP, energy and current turn (doc §4 - StatsPanel).
 */
export function StatsPanel({ gameState, campaignTitle }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.title} numberOfLines={1}>{campaignTitle}</Text>
      <View style={styles.stats}>
        <StatBadge label="HP" value={gameState.health} color="#E05C5C" />
        <StatBadge label="NRG" value={gameState.energy} color="#5B9BD6" />
        <StatBadge label="T" value={gameState.turnNumber} color="#9A9AB0" />
      </View>
    </View>
  );
}

function StatBadge({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <View style={styles.badge}>
      <Text style={[styles.badgeLabel, { color }]}>{label}</Text>
      <Text style={styles.badgeValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#13131F",
    borderBottomWidth: 1,
    borderBottomColor: "#2A2A45",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  title: {
    color: "#9A9AB0",
    fontSize: 13,
    fontWeight: "600",
    flex: 1,
    marginRight: 12,
  },
  stats: {
    flexDirection: "row",
    gap: 12,
  },
  badge: {
    alignItems: "center",
    gap: 1,
  },
  badgeLabel: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  badgeValue: {
    color: "#F5F5FF",
    fontSize: 14,
    fontWeight: "700",
  },
});
