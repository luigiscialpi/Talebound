import { Stack, Redirect } from "expo-router";
import { useAuth } from "../../src/hooks/useAuth";
import { ActivityIndicator, View } from "react-native";

/**
 * Layout for the (auth) route group.
 * If the user is already authenticated, redirect them straight to the game.
 * While the session is being restored from SecureStore, show a spinner.
 */
export default function AuthLayout() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: "#0B0B14", alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color="#5B5BD6" size="large" />
      </View>
    );
  }

  // Already logged in -> skip auth screens entirely.
  if (session) {
    return <Redirect href="/" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
