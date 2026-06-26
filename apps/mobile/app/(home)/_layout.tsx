import { Stack, Redirect } from "expo-router";
import type { Href } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { useAuth } from "../../src/hooks/useAuth";

/**
 * Layout for the (home) route group (doc §4).
 * Auth guard lives here: unauthenticated users are redirected to login.
 */
export default function HomeLayout() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: "#0B0B14", alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color="#5B5BD6" size="large" />
      </View>
    );
  }

  if (!session) {
    return <Redirect href={"/(auth)/login" as Href} />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
