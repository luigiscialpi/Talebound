import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import type { Href } from "expo-router";
import { useAuth } from "../../src/hooks/useAuth";
import { DEMO_CAMPAIGN } from "../../src/hooks/useGameState";

/**
 * Home screen: campaign list + save slots (doc §4 - app/(home)/index.tsx).
 * MVP: shows only the demo campaign. Future: fetch from /campaigns.
 */
export default function HomeScreen() {
  const { user, signOut } = useAuth();
  const router = useRouter();

  function handlePlay() {
    router.push("/(game)/play" as Href);
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.logo}>Talebound</Text>
          <Pressable onPress={signOut} accessibilityLabel="Esci dall'account">
            <Text style={styles.signOutText}>Esci</Text>
          </Pressable>
        </View>

        <Text style={styles.greeting}>
          Ciao, {user?.email?.split("@")[0] ?? "avventuriero"} 👋
        </Text>

        {/* Section: Campagne */}
        <Text style={styles.sectionTitle}>Campagne disponibili</Text>

        <Pressable style={styles.campaignCard} onPress={handlePlay}>
          <View style={styles.campaignBadge}>
            <Text style={styles.campaignBadgeText}>Fantasy</Text>
          </View>
          <Text style={styles.campaignTitle}>{DEMO_CAMPAIGN.title}</Text>
          <Text style={styles.campaignMeta}>10 stanze · Demo</Text>
          <View style={styles.playRow}>
            <Text style={styles.playLabel}>Gioca ora</Text>
            <Text style={styles.playArrow}>→</Text>
          </View>
        </Pressable>

        {/* Placeholder future campaigns */}
        <View style={[styles.campaignCard, styles.campaignCardLocked]}>
          <Text style={styles.lockedText}>
            Altre campagne in arrivo...
          </Text>
          <Text style={styles.campaignMeta}>Presto disponibili</Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0B0B14",
  },
  scroll: {
    padding: 24,
    paddingBottom: 40,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  logo: {
    color: "#F5F5FF",
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: 1,
  },
  signOutText: {
    color: "#6B6B80",
    fontSize: 14,
    fontWeight: "600",
  },
  greeting: {
    color: "#9A9AB0",
    fontSize: 15,
    marginBottom: 32,
  },
  sectionTitle: {
    color: "#F5F5FF",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 16,
    letterSpacing: 0.3,
  },
  campaignCard: {
    backgroundColor: "#1A1A2E",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#2A2A45",
    padding: 20,
    marginBottom: 12,
    gap: 8,
  },
  campaignCardLocked: {
    opacity: 0.45,
  },
  campaignBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#2A2A45",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  campaignBadgeText: {
    color: "#9A9AB0",
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  campaignTitle: {
    color: "#F5F5FF",
    fontSize: 20,
    fontWeight: "700",
  },
  lockedText: {
    color: "#6B6B80",
  },
  campaignMeta: {
    color: "#6B6B80",
    fontSize: 13,
  },
  playRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 6,
    marginTop: 8,
  },
  playLabel: {
    color: "#5B5BD6",
    fontSize: 14,
    fontWeight: "700",
  },
  playArrow: {
    color: "#5B5BD6",
    fontSize: 16,
    fontWeight: "700",
  },
});
