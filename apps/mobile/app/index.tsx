import { Redirect } from "expo-router";
import type { Href } from "expo-router";

/**
 * Root index: redirects straight to the home group.
 * Auth guard lives in app/(home)/_layout.tsx — single responsibility.
 */
export default function RootIndex() {
  return <Redirect href={"/(home)" as Href} />;
}
