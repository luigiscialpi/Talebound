import * as SecureStore from "expo-secure-store";
import { createClient } from "@supabase/supabase-js";
import Constants from "expo-constants";

/**
 * Supabase client singleton (doc §7 - Auth).
 *
 * SUPABASE_URL and SUPABASE_ANON_KEY are read from app.json > extra
 * (injected via expo-constants) so they are never baked into source.
 *
 * Session tokens are persisted via expo-secure-store, which uses the Android
 * Keystore / iOS Keychain under the hood. They survive app restarts without
 * requiring a new network round-trip.
 */

const extra = Constants.expoConfig?.extra as
  | { supabaseUrl?: string; supabaseAnonKey?: string }
  | undefined;

const supabaseUrl = extra?.supabaseUrl ?? "";
const supabaseAnonKey = extra?.supabaseAnonKey ?? "";

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    "[supabase] supabaseUrl or supabaseAnonKey missing in app.json extra. " +
      "Auth will not work until app.json is configured.",
  );
}

/**
 * expo-secure-store adapter implementing the Storage interface expected by
 * @supabase/supabase-js. Keys are stored encrypted on the device.
 */
const ExpoSecureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: ExpoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
