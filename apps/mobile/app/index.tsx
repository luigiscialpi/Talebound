import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Redirect } from "expo-router";
import type { Href } from "expo-router";
import { useAuth } from "../src/hooks/useAuth";

/**
 * Home / game entry screen.
 *
 * Auth guard pattern (doc §7):
 *  - loading -> spinner (avoids flash while SecureStore restores the session)
 *  - no session -> redirect to login (single, stable redirect — no loop)
 *  - session -> render the screen
 */
export default function HomeScreen() {
  const { session, user, loading, signOut } = useAuth();

  // Wait for session restore from SecureStore before deciding where to go.
  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#5B5BD6" size="large" />
      </View>
    );
  }

  // Not authenticated: single redirect, no loop because the Stack is always mounted.
  if (!session) {
    return <Redirect href={"/(auth)/login" as Href} />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Talebound</Text>
        <Text style={styles.subtitle}>Avventure testuali GenAI</Text>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Connesso come</Text>
          <Text style={styles.cardValue}>{user?.email ?? user?.id ?? "—"}</Text>
        </View>

        {/* TODO: game flow — campaign picker + /game/new + /game/action */}
        <Text style={styles.hint}>
          Il flusso di gioco sarà qui. Per ora verifica che il login funzioni.
        </Text>

        <Pressable
          style={styles.signOutButton}
          onPress={signOut}
          accessibilityRole="button"
          accessibilityLabel="Esci dall'account"
        >
          <Text style={styles.signOutText}>Esci</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    backgroundColor: "#0B0B14",
    alignItems: "center",
    justifyContent: "center",
  },
  container: {
    flex: 1,
    backgroundColor: "#0B0B14",
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    padding: 24,
  },
  title: {
    color: "#F5F5FF",
    fontSize: 40,
    fontWeight: "800",
    letterSpacing: 1,
  },
  subtitle: {
    color: "#9A9AB0",
    fontSize: 16,
    marginBottom: 8,
  },
  card: {
    backgroundColor: "#1A1A2E",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2A2A45",
    paddingHorizontal: 20,
    paddingVertical: 14,
    width: "100%",
    alignItems: "center",
    gap: 4,
  },
  cardLabel: {
    color: "#6B6B80",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  cardValue: {
    color: "#F5F5FF",
    fontSize: 15,
    fontWeight: "600",
  },
  hint: {
    color: "#6B6B80",
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
    marginTop: 8,
  },
  signOutButton: {
    marginTop: 16,
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#2A2A45",
  },
  signOutText: {
    color: "#9A9AB0",
    fontSize: 15,
    fontWeight: "600",
  },
});
