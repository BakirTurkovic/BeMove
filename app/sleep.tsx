import { useCallback, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { Moon, Sparkles } from "lucide-react-native";
import {
  AppScreen,
  Card,
  DataErrorState,
  ErrorMessage,
  Header,
  LoadingState,
  PrimaryButton,
  SectionTitle
} from "@/components/ui";
import { createSleepLog, getDataErrorMessage, listSleepLogs, todayLocal } from "@/lib/data";
import { supabase } from "@/lib/supabase";
import type { SleepLog } from "@/lib/types";

const sleepQualities = [
  { value: "poor", label: "Loše" },
  { value: "fair", label: "Solidno" },
  { value: "good", label: "Dobro" },
  { value: "excellent", label: "Odlično" }
] as const;

export default function SleepScreen() {
  const [logs, setLogs] = useState<SleepLog[]>([]);
  const [hours, setHours] = useState("");
  const [quality, setQuality] = useState<SleepLog["quality"]>("good");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<{ kind: "error" | "success"; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!data.user) throw new Error("Sesija je istekla. Prijavi se ponovo.");
      setLogs(await listSleepLogs(data.user.id));
    } catch (loadError) {
      setError(getDataErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    void load();
  }, [load]));

  async function saveSleepLog() {
    const duration = Number(hours.replace(",", "."));
    if (!Number.isFinite(duration) || duration <= 0 || duration > 24) {
      setActionMessage({ kind: "error", text: "Unesi trajanje sna veće od 0 i najviše 24 sata." });
      return;
    }

    setSaving(true);
    setActionMessage(null);
    try {
      const { data, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!data.user) throw new Error("Sesija je istekla. Prijavi se ponovo.");
      await createSleepLog(data.user.id, {
        hours_slept: Math.round(duration * 100) / 100,
        quality,
        notes: notes.trim() || null,
        date: todayLocal()
      });
      setHours("");
      setNotes("");
      setActionMessage({ kind: "success", text: "Unos sna je sačuvan." });
      await load();
    } catch (saveError) {
      setActionMessage({
        kind: "error",
        text: `Unos sna nije sačuvan: ${getDataErrorMessage(saveError)}`
      });
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <AppScreen><LoadingState /></AppScreen>;
  if (error) return <AppScreen><DataErrorState message={error} onRetry={() => void load()} /></AppScreen>;

  const today = todayLocal();
  const todayLogs = logs.filter((log) => log.date === today);
  const latestSleep = todayLogs.reduce((total, log) => total + log.hours_slept, 0);
  const lastSeven = logs.slice(0, 7);
  const weeklyAverage = lastSeven.length
    ? lastSeven.reduce((total, log) => total + log.hours_slept, 0) / lastSeven.length
    : 0;

  return (
    <AppScreen>
      <Header title="San" subtitle="ODMOR JE DIO TVOG NAPRETKA" />
      <Card className="bg-brand">
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="text-sm font-semibold text-white/80">San zabilježen danas</Text>
            <Text className="mt-2 text-4xl font-extrabold text-white">
              {latestSleep.toFixed(1)} <Text className="text-base">sati</Text>
            </Text>
          </View>
          <View className="rounded-2xl bg-white/20 p-3"><Moon size={25} color="white" /></View>
        </View>
        <View className="my-4 h-px bg-white/25" />
        <View className="flex-row items-center gap-2">
          <Sparkles size={16} color="white" />
          <Text className="text-sm text-white/90">
            Prosjek posljednjih unosa: {weeklyAverage.toFixed(1)} h
          </Text>
        </View>
      </Card>

      <SectionTitle title="Zabilježi san" />
      <Card>
        <Text className="mb-2 text-sm font-semibold text-ink">Koliko si sati spavao/la?</Text>
        <View className="flex-row items-center rounded-2xl bg-canvas px-4">
          <TextInput
            className="min-h-12 flex-1 py-3 text-lg font-bold text-ink"
            placeholder="npr. 7.5"
            placeholderTextColor="#98989F"
            keyboardType="decimal-pad"
            value={hours}
            onChangeText={(value) => {
              setHours(value);
              setActionMessage(null);
            }}
            editable={!saving}
          />
          <Text className="text-sm font-semibold text-muted">sati</Text>
        </View>

        <Text className="mb-2 mt-5 text-sm font-semibold text-ink">Kvalitet sna</Text>
        <View className="flex-row flex-wrap gap-2">
          {sleepQualities.map((item) => {
            const selected = quality === item.value;
            return (
              <Pressable
                key={item.value}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                disabled={saving}
                onPress={() => setQuality(item.value)}
                className={`rounded-full px-4 py-2.5 ${selected ? "bg-brand" : "bg-canvas"}`}
              >
                <Text className={`text-xs font-bold ${selected ? "text-white" : "text-muted"}`}>{item.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text className="mb-2 mt-5 text-sm font-semibold text-ink">Bilješka (opcionalno)</Text>
        <TextInput
          className="min-h-20 rounded-2xl bg-canvas px-4 py-3 text-ink"
          placeholder="Kako se osjećaš nakon odmora?"
          placeholderTextColor="#98989F"
          value={notes}
          onChangeText={(value) => {
            setNotes(value);
            setActionMessage(null);
          }}
          multiline
          maxLength={500}
          editable={!saving}
          textAlignVertical="top"
        />
        {actionMessage && (
          <View className="mt-4">
            {actionMessage.kind === "error"
              ? <ErrorMessage message={actionMessage.text} />
              : <Text className="rounded-2xl bg-[#EAF8EF] px-4 py-3 text-sm text-[#247A43]">{actionMessage.text}</Text>}
          </View>
        )}
        <View className="mt-4">
          <PrimaryButton
            label={saving ? "Spremanje..." : "Sačuvaj unos sna"}
            onPress={() => void saveSleepLog()}
            disabled={saving}
          />
        </View>
      </Card>

      <SectionTitle title="Nedavni unosi" />
      {logs.length === 0 ? (
        <Card><Text className="text-sm leading-5 text-muted">Još nema unosa sna. Zabilježi prvi kako bi pratio/la svoj odmor.</Text></Card>
      ) : logs.map((log) => (
        <Card key={log.id} className="mb-3 flex-row items-center">
          <View className="mr-3 h-11 w-11 items-center justify-center rounded-2xl bg-blush">
            <Moon size={20} color="#FF2D55" />
          </View>
          <View className="flex-1">
            <Text className="font-bold text-ink">{new Date(`${log.date}T12:00:00`).toLocaleDateString()}</Text>
            <Text className="mt-1 text-xs text-muted">
              {log.quality ? sleepQualities.find((item) => item.value === log.quality)?.label : "Kvalitet nije naveden"}
              {log.notes ? ` · ${log.notes}` : ""}
            </Text>
          </View>
          <Text className="text-base font-extrabold text-brand">{Number(log.hours_slept).toFixed(1)} h</Text>
        </Card>
      ))}
    </AppScreen>
  );
}
