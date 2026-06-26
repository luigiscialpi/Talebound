import { useEffect, useRef } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

interface Turn {
  action: string;
  narrative: string;
  blocked: boolean;
}

interface Props {
  turns: Turn[];
  /** Text to show as the intro before any player action. */
  intro?: string;
}

/**
 * Scrollable narrative history (doc §4 - components/game/OutputText.tsx).
 * Each turn shows the player's action and the AI narrative response.
 * Auto-scrolls to bottom after each new turn.
 */
export function NarrativeScroll({ turns, intro }: Props) {
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [turns.length]);

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.scroll}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {intro ? (
        <Text style={styles.intro}>{intro}</Text>
      ) : null}

      {turns.map((turn, index) => (
        <View key={index} style={styles.turnBlock}>
          {/* Player action */}
          <View style={styles.actionRow}>
            <Text style={styles.actionPrompt}>&gt;</Text>
            <Text style={styles.actionText}>{turn.action}</Text>
          </View>

          {/* AI narrative */}
          <Text
            style={[
              styles.narrativeText,
              turn.blocked && styles.narrativeBlocked,
            ]}
          >
            {turn.narrative}
          </Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 8,
    gap: 20,
  },
  intro: {
    color: "#C8C8E0",
    fontSize: 15,
    lineHeight: 24,
    fontStyle: "italic",
  },
  turnBlock: {
    gap: 10,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  actionPrompt: {
    color: "#5B5BD6",
    fontSize: 15,
    fontWeight: "800",
    lineHeight: 22,
  },
  actionText: {
    color: "#9A9AB0",
    fontSize: 15,
    fontWeight: "600",
    flex: 1,
    lineHeight: 22,
  },
  narrativeText: {
    color: "#E8E8F8",
    fontSize: 15,
    lineHeight: 24,
  },
  narrativeBlocked: {
    color: "#FF8080",
    fontStyle: "italic",
  },
});
