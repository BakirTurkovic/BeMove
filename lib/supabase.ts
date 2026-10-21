import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

function isSupportedPublicKey(key: string) {
  if (key.startsWith("sb_publishable_")) {
    return key.length > "sb_publishable_".length;
  }

  const jwtParts = key.split(".");
  return jwtParts.length === 3 && jwtParts.every((part) => part.length > 0);
}

if (!supabaseUrl) {
  const message = "Supabase URL is missing. Set EXPO_PUBLIC_SUPABASE_URL in the project-root .env file.";
  console.error(`[BeMove] ${message}`);
  throw new Error(message);
}

if (!supabaseAnonKey) {
  const message = "Supabase public key is missing. Set EXPO_PUBLIC_SUPABASE_ANON_KEY in the project-root .env file.";
  console.error(`[BeMove] ${message}`);
  throw new Error(message);
}

if (!isSupportedPublicKey(supabaseAnonKey)) {
  const message = "Supabase public key has an unsupported format. Use this project's sb_publishable_ key or legacy anon JWT key.";
  console.error(`[BeMove] ${message}`);
  throw new Error(message);
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false
  }
});
