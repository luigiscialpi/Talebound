import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../src/hooks/useAuth";

/**
 * Login screen: email + password -> Supabase signInWithPassword.
 * On success the AuthProvider updates session, the root layout
 * detects the change and navigates the user away from the auth group.
 */
export default function LoginScreen() {
  const { signIn } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSignIn() {
    if (!email.trim() || !password) {
      setError("Inserisci email e password.");
      return;
    }
    setError(null);
    setLoading(true);
    const authError = await signIn(email.trim(), password);
    setLoading(false);
    if (authError) {
      setError(authError.message);
    }
    // On success: session state updates -> root layout redirects.
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.inner}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <Text style={styles.title}>Talebound</Text>
        <Text style={styles.subtitle}>Accedi per continuare la tua avventura</Text>

        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor="#6B6B80"
            autoCapitalize="none"
            keyboardType="email-address"
            textContentType="emailAddress"
            value={email}
            onChangeText={setEmail}
            accessibilityLabel="Campo email"
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="#6B6B80"
            secureTextEntry
            textContentType="password"
            value={password}
            onChangeText={setPassword}
            onSubmitEditing={handleSignIn}
            returnKeyType="go"
            accessibilityLabel="Campo password"
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleSignIn}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel="Accedi"
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.buttonText}>Accedi</Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0B0B14",
  },
  inner: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 8,
  },
  title: {
    color: "#F5F5FF",
    fontSize: 40,
    fontWeight: "800",
    letterSpacing: 1,
    marginBottom: 4,
  },
  subtitle: {
    color: "#9A9AB0",
    fontSize: 15,
    textAlign: "center",
    marginBottom: 32,
  },
  form: {
    width: "100%",
    gap: 12,
  },
  input: {
    backgroundColor: "#1A1A2E",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2A2A45",
    color: "#F5F5FF",
    fontSize: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  error: {
    color: "#FF6B6B",
    fontSize: 13,
    textAlign: "center",
  },
  button: {
    marginTop: 8,
    backgroundColor: "#5B5BD6",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "700",
  },
});
