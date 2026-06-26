import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from "react-native";

interface Props {
  onSubmit: (action: string) => void;
  disabled?: boolean;
  loading?: boolean;
}

/**
 * Command input bar (doc §4 - components/game/CommandInput.tsx).
 * Submits on button press or keyboard "go" action.
 * Clears input after submission.
 */
export function CommandInput({ onSubmit, disabled = false, loading = false }: Props) {
  const [text, setText] = useState("");

  function handleSubmit() {
    const trimmed = text.trim();
    if (!trimmed || disabled || loading) return;
    onSubmit(trimmed);
    setText("");
  }

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        value={text}
        onChangeText={setText}
        placeholder="Cosa fai?"
        placeholderTextColor="#4A4A60"
        editable={!disabled && !loading}
        onSubmitEditing={handleSubmit}
        returnKeyType="go"
        multiline={false}
        accessibilityLabel="Campo azione di gioco"
      />
      <Pressable
        style={[styles.sendButton, (disabled || loading || !text.trim()) && styles.sendButtonDisabled]}
        onPress={handleSubmit}
        disabled={disabled || loading || !text.trim()}
        accessibilityRole="button"
        accessibilityLabel="Invia azione"
      >
        {loading ? (
          <ActivityIndicator color="#FFFFFF" size="small" />
        ) : (
          // ASCII arrow — no emoji in code (GEMINI.md rule).
          // Visual: a right-pointing chevron built from text.
          <View style={styles.arrowIcon}>
            <View style={[styles.arrowLine, styles.arrowTop]} />
            <View style={[styles.arrowLine, styles.arrowBottom]} />
          </View>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1A1A2E",
    borderTopWidth: 1,
    borderTopColor: "#2A2A45",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  input: {
    flex: 1,
    backgroundColor: "#0E0E1E",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#2A2A45",
    color: "#F5F5FF",
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  sendButton: {
    backgroundColor: "#5B5BD6",
    borderRadius: 10,
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
  },
  sendButtonDisabled: {
    backgroundColor: "#2A2A45",
  },
  arrowIcon: {
    width: 14,
    height: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  arrowLine: {
    position: "absolute",
    width: 8,
    height: 2,
    backgroundColor: "#FFFFFF",
    borderRadius: 1,
  },
  arrowTop: {
    transform: [{ rotate: "-45deg" }, { translateY: -3 }],
  },
  arrowBottom: {
    transform: [{ rotate: "45deg" }, { translateY: 3 }],
  },
});
