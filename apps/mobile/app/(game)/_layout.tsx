import { Stack } from "expo-router";

/** Layout for the (game) route group — no auth guard needed here since
 *  (home) already protects the entry point. */
export default function GameLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
