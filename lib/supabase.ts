import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || "https://nsbysklbagqjtkutqwdv.supabase.co";
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
  || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5zYnlza2xiYWdxanRrdXRxd2R2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mjk0MzM2MzcsImV4cCI6MjA0NTAwOTYzN30.C3iH6Hvh-D3LWyM4p49jJgBwJ5T2kM0wP1263uD27QY";
const serverSessionStorage = new Map<string, string>();

const sessionStorage = {
  getItem: (key: string) => typeof window === "undefined"
    ? Promise.resolve(serverSessionStorage.get(key) ?? null)
    : AsyncStorage.getItem(key),
  setItem: (key: string, value: string) => {
    if (typeof window === "undefined") {
      serverSessionStorage.set(key, value);
      return Promise.resolve();
    }
    return AsyncStorage.setItem(key, value);
  },
  removeItem: (key: string) => {
    if (typeof window === "undefined") {
      serverSessionStorage.delete(key);
      return Promise.resolve();
    }
    return AsyncStorage.removeItem(key);
  }
};

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
    storage: sessionStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false
  }
});
