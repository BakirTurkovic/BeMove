import { useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Dumbbell, HeartPulse, Sparkles } from "lucide-react-native";
import { supabase } from "@/lib/supabase";
import { PrimaryButton } from "@/components/ui";

export default function AuthScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [registering, setRegistering] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "error" | "success"; text: string } | null>(null);

  async function submit() {
    try {
      const normalizedEmail = email.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) || password.length < 6) {
        setMessage({
          kind: "error",
          text: "Unesi ispravnu email adresu i lozinku od najmanje 6 znakova."
        });
        return;
      }

      setBusy(true);
      setMessage(null);
      const result = registering
        ? await supabase.auth.signUp({ email: normalizedEmail, password })
        : await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
      if (result.error) throw result.error;
      if (registering && !result.data.session) {
        setMessage({
          kind: "success",
          text: "Nalog je kreiran. Provjeri email i potvrdi adresu prije prijave."
        });
      }
    } catch (error) {
      setMessage({
        kind: "error",
        text: error instanceof Error ? error.message : "Prijava nije uspjela. Pokušaj ponovo."
      });
    } finally {
      setBusy(false);
    }
  }

  async function continueAsGuest() {
    setBusy(true);
    setMessage(null);
    try {
      const { error } = await supabase.auth.signInAnonymously();
      if (error) {
        if (error.message.toLowerCase().includes("anonymous")) {
          throw new Error("Gostujući pristup trenutno nije omogućen. Administrator treba uključiti Anonymous Sign-Ins u Supabase Auth postavkama.");
        }
        throw error;
      }
    } catch (error) {
      setMessage({
        kind: "error",
        text: error instanceof Error ? error.message : "Gostujuća prijava nije uspjela. Pokušaj ponovo."
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-canvas">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ flexGrow: 1, justifyContent: "center", paddingHorizontal: 24, paddingVertical: 28 }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="w-full max-w-[460px] self-center">
          <View
            className="rounded-[32px] bg-white p-6"
            style={{ shadowColor: "#1C1C1E", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 24, elevation: 5 }}
          >
        <View className="mb-6 h-16 w-16 items-center justify-center rounded-3xl bg-blush">
          <Dumbbell size={30} color="#FF2D55" />
        </View>
        <Text className="text-4xl font-extrabold tracking-tight text-ink">BeMove</Text>
        <Text className="mb-7 mt-2 text-base leading-6 text-muted">Treniraj pametno. Kreći se snažno. Prati svoj napredak.</Text>
        <View className="gap-3">
        <TextInput
          className="rounded-2xl bg-canvas px-4 py-4 text-ink"
          placeholder="Email adresa"
          placeholderTextColor="#98989F"
          autoCapitalize="none"
          autoComplete="email"
          textContentType="emailAddress"
          keyboardType="email-address"
          editable={!busy}
          value={email}
          onChangeText={(value) => {
            setEmail(value);
            setMessage(null);
          }}
        />
        <TextInput
          className="rounded-2xl bg-canvas px-4 py-4 text-ink"
          placeholder="Lozinka (najmanje 6 znakova)"
          placeholderTextColor="#98989F"
          secureTextEntry
          autoComplete={registering ? "new-password" : "current-password"}
          textContentType={registering ? "newPassword" : "password"}
          autoCapitalize="none"
          editable={!busy}
          value={password}
          onChangeText={(value) => {
            setPassword(value);
            setMessage(null);
          }}
        />
        {message && (
          <Text
            accessibilityRole={message.kind === "error" ? "alert" : "text"}
            className={`rounded-2xl px-4 py-3 text-sm leading-5 ${
              message.kind === "error" ? "bg-[#FFF0F2] text-[#B4233A]" : "bg-[#EAF8EF] text-[#247A43]"
            }`}
          >
            {message.text}
          </Text>
        )}
          <PrimaryButton label={busy ? "Molimo sačekaj..." : registering ? "Kreiraj nalog" : "Prijavi se"} onPress={() => void submit()} disabled={busy} />
        </View>
        <Pressable
          accessibilityRole="button"
          disabled={busy}
          className={`mt-3 flex-row items-center justify-center gap-2 rounded-2xl border border-[#F0F0F3] bg-white px-5 py-4 ${busy ? "opacity-50" : ""}`}
          onPress={() => void continueAsGuest()}
        >
          <Sparkles size={17} color="#FF6B00" />
          <Text className="font-bold text-ink">Nastavi kao gost</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          disabled={busy}
          className={`mt-6 flex-row items-center justify-center gap-2 ${busy ? "opacity-50" : ""}`}
          onPress={() => {
            setRegistering(!registering);
            setMessage(null);
          }}
        >
          <HeartPulse size={16} color="#FF2D55" />
          <Text className="font-semibold text-brand">
            {registering ? "Već imaš nalog? Prijavi se" : "Nemaš nalog? Kreiraj ga"}
          </Text>
        </Pressable>
        <Text className="mt-5 text-center text-xs leading-5 text-muted">Gostujući podaci su vezani za ovaj privremeni nalog. Poveži email u profilu da ih sačuvaš.</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
