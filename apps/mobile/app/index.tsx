import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function HomeScreen() {
  const [count, setCount] = useState(0);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Talebound</Text>
        <Text style={styles.subtitle}>Avventure testuali GenAI</Text>

        <Pressable style={styles.button} onPress={() => setCount((c) => c + 1)}>
          <Text style={styles.buttonText}>Tocchi: {count}</Text>
        </Pressable>

        <Text style={styles.hint}>
          Modifica questo file e salva: vedrai l'aggiornamento all'istante
          grazie al Fast Refresh di Metro.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
  },
  button: {
    marginTop: 24,
    backgroundColor: "#5B5BD6",
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 12,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "600",
  },
  hint: {
    color: "#6B6B80",
    fontSize: 13,
    textAlign: "center",
    marginTop: 16,
    lineHeight: 18,
  },
});
