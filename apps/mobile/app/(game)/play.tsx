import { useEffect } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useGameState, DEMO_CAMPAIGN } from "../../src/hooks/useGameState";
import { NarrativeScroll } from "../../src/components/game/NarrativeScroll";
import { CommandInput } from "../../src/components/game/CommandInput";
import { StatsPanel } from "../../src/components/game/StatsPanel";

/**
 * Main game screen (doc §4 - app/(game)/play.tsx).
 *
 * Lifecycle:
 *  1. Mount -> startGame() -> /game/new -> receives initial GameState
 *  2. User types action -> sendAction() -> /game/action -> narrative appended
 *  3. StatsPanel shows live HP/energy/turn; NarrativeScroll shows history
 */
export default function PlayScreen() {
  const router = useRouter();
  const { phase, gameState, turns, error, startGame, sendAction } = useGameState();

  // Start the game automatically when the screen mounts.
  useEffect(() => {
    startGame();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------------------------------------------------------------------------
  // Loading state (initial game start)
  // ---------------------------------------------------------------------------
  if (phase === "loading" && !gameState) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator color="#5B5BD6" size="large" />
        <Text style={styles.loadingText}>Preparazione avventura...</Text>
      </SafeAreaView>
    );
  }

  // ---------------------------------------------------------------------------
  // Error state
  // ---------------------------------------------------------------------------
  if (phase === "error" || (!gameState && error)) {
    return (
      <SafeAreaView style={styles.centered}>
        <Text style={styles.errorTitle}>Errore di connessione</Text>
        <Text style={styles.errorText}>{error}</Text>
        <Pressable style={styles.retryButton} onPress={startGame}>
          <Text style={styles.retryText}>Riprova</Text>
        </Pressable>
        <Pressable onPress={() => router.back()} style={styles.backLink}>
          <Text style={styles.backLinkText}>Torna alla home</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  // ---------------------------------------------------------------------------
  // Game screen
  // ---------------------------------------------------------------------------
  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      {/* Back button + stats */}
      <View style={styles.topBar}>
        <Pressable
          onPress={() => router.back()}
          style={styles.backButton}
          accessibilityLabel="Torna alla home"
        >
          <Text style={styles.backArrow}>{"<"}</Text>
        </Pressable>
        {gameState && (
          <View style={styles.statsWrapper}>
            <StatsPanel
              gameState={gameState}
              campaignTitle={DEMO_CAMPAIGN.title}
            />
          </View>
        )}
      </View>

      {/* Narrative area */}
      <KeyboardAvoidingView
        style={styles.gameArea}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
      >
        <NarrativeScroll
          turns={turns}
          intro={
            turns.length === 0
              ? "L'avventura inizia. Cosa fai?"
              : undefined
          }
        />

        {/* Loading overlay during action processing */}
        {phase === "loading" && gameState && (
          <View style={styles.actionLoading}>
            <ActivityIndicator color="#5B5BD6" size="small" />
          </View>
        )}

        <CommandInput
          onSubmit={sendAction}
          disabled={phase === "loading"}
          loading={phase === "loading"}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0B0B14",
  },
  centered: {
    flex: 1,
    backgroundColor: "#0B0B14",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 16,
  },
  loadingText: {
    color: "#9A9AB0",
    fontSize: 15,
    marginTop: 8,
  },
  errorTitle: {
    color: "#FF8080",
    fontSize: 18,
    fontWeight: "700",
  },
  errorText: {
    color: "#9A9AB0",
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
  retryButton: {
    backgroundColor: "#5B5BD6",
    borderRadius: 10,
    paddingHorizontal: 24,
    paddingVertical: 12,
    marginTop: 8,
  },
  retryText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  backLink: {
    marginTop: 4,
  },
  backLinkText: {
    color: "#6B6B80",
    fontSize: 14,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#2A2A45",
  },
  backButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backArrow: {
    color: "#9A9AB0",
    fontSize: 18,
    fontWeight: "700",
  },
  statsWrapper: {
    flex: 1,
  },
  gameArea: {
    flex: 1,
  },
  actionLoading: {
    position: "absolute",
    bottom: 72,
    alignSelf: "center",
    backgroundColor: "#1A1A2E",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
});
