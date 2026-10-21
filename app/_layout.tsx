import "../global.css";
import { useEffect, useState } from "react";
import { Redirect, Stack, usePathname } from "expo-router";
import { StatusBar } from "expo-status-bar";
import type { Session } from "@supabase/supabase-js";
import { ActivityIndicator, View } from "react-native";
import { supabase } from "@/lib/supabase";

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    let mounted = true;
    let authEventReceived = false;

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      authEventReceived = true;
      if (!mounted) return;
      setSession(nextSession);
      setAuthReady(true);
    });

    void supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted || authEventReceived) return;
      if (error) console.error("Could not restore Supabase session:", error.message);
      setSession(data.session);
      setAuthReady(true);
    }).catch((error: unknown) => {
      if (!mounted || authEventReceived) return;
      console.error("Could not restore Supabase session:", error);
      setSession(null);
      setAuthReady(true);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  if (!authReady) {
    return (
      <View className="flex-1 items-center justify-center bg-canvas">
        <ActivityIndicator color="#FF2D55" size="large" />
      </View>
    );
  }

  if (!session && pathname !== "/auth") return <Redirect href="/auth" />;
  if (session && pathname === "/auth") return <Redirect href="/" />;

  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#F8F9FA" } }} />
    </>
  );
}
