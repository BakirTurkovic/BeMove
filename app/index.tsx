import { useCallback, useState } from "react";
import { ActivityIndicator, Platform, Pressable, Text, TextInput, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { ArrowUpRight, Flame, Footprints, Moon, Plus, RefreshCw, Salad, Target, Timer, TrendingDown } from "lucide-react-native";
import { Pedometer } from "expo-sensors";
import { AppScreen, Card, DataErrorState, Header, LoadingState, Metric, SectionTitle } from "@/components/ui";
import { getDashboardSummary, getDataErrorMessage, getStepLog, saveProfile, syncSteps, todayLocal } from "@/lib/data";
import { supabase } from "@/lib/supabase";
import type { DashboardSummary } from "@/lib/types";

const DAILY_STEP_GOAL = 10_000;

function calorieValue(value: unknown, fallback = 0) {
  if (value === null || value === undefined || value === "") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

export default function DashboardScreen() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stepCount, setStepCount] = useState(0);
  const [manualSteps, setManualSteps] = useState("");
  const [stepLoading, setStepLoading] = useState(true);
  const [stepSaving, setStepSaving] = useState(false);
  const [stepMessage, setStepMessage] = useState<string | null>(null);
  const [stepError, setStepError] = useState<string | null>(null);
  const [sensorUnavailable, setSensorUnavailable] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error) throw error;
      const profile = await getDashboardSummary(data.user.id);
      setSummary(profile);
      if (profile.profile.starting_weight_kg === null) {
        await saveProfile(data.user.id, { starting_weight_kg: profile.currentWeight ?? 115 });
      }
    } catch (error) {
      setError(getDataErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const syncSensorSteps = useCallback(async () => {
    setStepLoading(true);
    setStepError(null);
    setStepMessage(null);
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!authData.user) throw new Error("Sesija je istekla. Prijavi se ponovo.");

      const savedLog = await getStepLog(authData.user.id, todayLocal());
      if (savedLog) setStepCount(savedLog.step_count);

      if (Platform.OS === "web") {
        setSensorUnavailable(true);
        return;
      }

      const available = await Pedometer.isAvailableAsync();
      if (!available) {
        setSensorUnavailable(true);
        return;
      }

      let permission = await Pedometer.getPermissionsAsync();
      if (!permission.granted) permission = await Pedometer.requestPermissionsAsync();
      if (!permission.granted) {
        setSensorUnavailable(true);
        setStepError("Dozvola za pristup podacima o kretanju nije odobrena. Možeš ručno unijeti korake.");
        return;
      }

      if (Platform.OS !== "ios") {
        setSensorUnavailable(true);
        setStepError("Dnevni zbir koraka nije dostupan preko ovog senzora na ovom uređaju. Unesi korake ručno.");
        return;
      }

      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const result = await Pedometer.getStepCountAsync(startOfDay, new Date());
      const saved = await syncSteps(authData.user.id, result.steps);
      setStepCount(saved.step_count);
      setSensorUnavailable(false);
      setStepMessage("Koraci su sinhronizovani s pedometrom.");
    } catch (syncError) {
      setSensorUnavailable(true);
      setStepError(getDataErrorMessage(syncError));
    } finally {
      setStepLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    void syncSensorSteps();
  }, [syncSensorSteps]));

  async function saveManualSteps() {
    const value = Number(manualSteps);
    if (!Number.isSafeInteger(value) || value < 0) {
      setStepError("Unesi cijeli broj koraka, veći ili jednak nuli.");
      setStepMessage(null);
      return;
    }
    setStepSaving(true);
    setStepError(null);
    setStepMessage(null);
    try {
      const { data, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!data.user) throw new Error("Sesija je istekla. Prijavi se ponovo.");
      const saved = await syncSteps(data.user.id, value);
      setStepCount(saved.step_count);
      setManualSteps("");
      setStepMessage("Dnevni koraci su sačuvani.");
    } catch (saveError) {
      setStepError(getDataErrorMessage(saveError));
    } finally {
      setStepSaving(false);
    }
  }

  if (loading && !summary) {
    return (
      <AppScreen>
        <Header
          title="Dobro došao!"
          subtitle={`${new Intl.DateTimeFormat("bs-BA", { weekday: "long" }).format(new Date()).toLocaleUpperCase()}, TVOJ NOVI POČETAK`}
        />
        <SectionTitle title="Današnji kalorijski balans" compact />
        <Card className="bg-brand">
          <View className="min-h-32 items-center justify-center">
            <ActivityIndicator color="white" />
            <Text className="mt-3 text-sm font-semibold text-white/80">Učitavam kalorijski balans...</Text>
          </View>
        </Card>
      </AppScreen>
    );
  }
  if (error) return <AppScreen><DataErrorState message={error} onRetry={() => void load()} /></AppScreen>;
  if (!summary) {
    return (
      <AppScreen>
        <DataErrorState message="Nema dostupnih podataka za dashboard." onRetry={() => void load()} />
      </AppScreen>
    );
  }

  const consumedCalories = calorieValue(summary.caloriesConsumed);
  const burnedCalories = calorieValue(summary.caloriesBurned);
  const targetCalories = calorieValue(
    summary.profile.calories_target,
    calorieValue(summary.profile.calorie_goal, 2500)
  ) || 2500;
  const remainingCalories = targetCalories - consumedCalories + burnedCalories;
  const calorieProgress = Math.min(100, (consumedCalories / targetCalories) * 100);
  const start = summary.profile.starting_weight_kg ?? summary.currentWeight ?? 115;
  const current = summary.currentWeight ?? start;
  const target = summary.profile.target_weight_kg;
  const lost = Math.max(0, start - current);
  const total = Math.max(1, start - target);
  const progress = Math.min(100, (lost / total) * 100);

  async function signOut() {
    try {
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) throw signOutError;
    } catch (signOutError) {
      setError(getDataErrorMessage(signOutError));
    }
  }

  return (
    <AppScreen>
      <Header
        title="Dobro došao!"
        subtitle={`${new Intl.DateTimeFormat("bs-BA", { weekday: "long" }).format(new Date()).toLocaleUpperCase()}, TVOJ NOVI POČETAK`}
        right={<Pressable onPress={signOut}><Text className="text-sm font-semibold text-muted">Odjava</Text></Pressable>}
      />
      <SectionTitle title="Tvoj napredak" action={`${progress.toFixed(0)}%`} compact />
      <Card>
        <View className="flex-row items-end justify-between">
          <View>
            <Text className="text-sm text-muted">Trenutna težina</Text>
            <Text className="mt-1 text-4xl font-extrabold text-ink">{current.toFixed(1)} <Text className="text-base font-semibold text-muted">kg</Text></Text>
          </View>
          <View className="items-end">
            <Text className="text-xs font-medium text-muted">CILJ</Text>
            <Text className="text-lg font-bold text-brand">{target.toFixed(0)} kg</Text>
          </View>
        </View>
        <View className="mt-5 h-2 overflow-hidden rounded-full bg-[#F0F0F2]">
          <View className="h-full rounded-full bg-brand" style={{ width: `${progress}%` }} />
        </View>
        <View className="mt-3 flex-row items-center gap-1">
          <TrendingDown size={15} color="#FF2D55" />
          <Text className="text-xs font-semibold text-brand">{lost.toFixed(1)} kg do sada</Text>
          <Text className="text-xs text-muted"> · početak {start.toFixed(1)} kg</Text>
        </View>
      </Card>

      <SectionTitle title="Današnji kalorijski balans" />
      <Card className="bg-brand">
        <View className="flex-row items-start justify-between">
          <View>
            <Text className="text-sm font-semibold text-white/80">DNEVNI KALORIJSKI CILJ</Text>
            <Text className="mt-3 text-4xl font-extrabold text-white">
              {Math.abs(remainingCalories) <= 25
                ? "Cilj postignut!"
                : remainingCalories < 0
                  ? `${Math.abs(Math.round(remainingCalories)).toLocaleString()} kcal`
                  : `${Math.round(remainingCalories).toLocaleString()} kcal`}
            </Text>
            <Text className="mt-1 text-sm text-white/85">
              {Math.abs(remainingCalories) <= 25
                ? "Odlično odrađen dnevni balans"
                : remainingCalories < 0
                  ? "preko dnevnog cilja"
                  : "preostalo za danas"}
            </Text>
          </View>
          <View className="rounded-2xl bg-white/20 p-3"><Flame size={23} color="white" /></View>
        </View>
        <View className="mt-5">
          <View className="mb-2 flex-row items-center justify-between">
            <Text className="text-xs font-semibold text-white/85">Unos kalorija</Text>
            <Text className="text-xs font-bold text-white">{Math.round(calorieProgress)}%</Text>
          </View>
          <View className="h-2 overflow-hidden rounded-full bg-white/25">
            <View className="h-full rounded-full bg-white" style={{ width: `${calorieProgress}%` }} />
          </View>
        </View>
        <View className="my-5 h-px bg-white/25" />
        <View className="flex-row">
          <View className="flex-1">
            <View className="mb-1 flex-row items-center gap-1.5">
              <Salad size={14} color="white" />
              <Text className="text-[11px] font-medium text-white/80">Uneseno</Text>
            </View>
            <Text className="text-sm font-extrabold text-white">{Math.round(consumedCalories).toLocaleString()} kcal</Text>
          </View>
          <View className="flex-1 items-center">
            <View className="mb-1 flex-row items-center gap-1.5">
              <Flame size={14} color="white" />
              <Text className="text-[11px] font-medium text-white/80">Potrošeno</Text>
            </View>
            <Text className="text-sm font-extrabold text-white">{Math.round(burnedCalories).toLocaleString()} kcal</Text>
          </View>
          <View className="flex-1 items-end">
            <View className="mb-1 flex-row items-center gap-1.5">
              <Target size={14} color="white" />
              <Text className="text-[11px] font-medium text-white/80">Cilj</Text>
            </View>
            <Text className="text-sm font-extrabold text-white">{Math.round(targetCalories).toLocaleString()} kcal</Text>
          </View>
        </View>
      </Card>

      <SectionTitle title="Danas" />
      <Card className="flex-row">
        <Metric label="Proteini" value={Math.round(summary.protein)} unit="g" />
        <View className="mx-4 w-px bg-[#EFEFF2]" />
        <Metric label="Treninzi" value={summary.caloriesBurned.toLocaleString()} unit="kcal" />
      </Card>

      <SectionTitle title="Brzi unos" />
      <View className="flex-row gap-3">
        <Pressable onPress={() => router.push("/meals")} className="flex-1 rounded-3xl bg-white p-4">
          <View className="mb-4 h-10 w-10 items-center justify-center rounded-2xl bg-blush"><Salad size={20} color="#FF2D55" /></View>
          <Text className="font-bold text-ink">Dodaj obrok</Text>
          <Text className="mt-1 text-xs text-muted">Kalorije i proteini</Text>
          <ArrowUpRight size={17} color="#FF2D55" style={{ position: "absolute", right: 16, top: 17 }} />
        </Pressable>
        <Pressable onPress={() => router.push("/workouts")} className="flex-1 rounded-3xl bg-white p-4">
          <View className="mb-4 h-10 w-10 items-center justify-center rounded-2xl bg-blush"><Timer size={20} color="#FF2D55" /></View>
          <Text className="font-bold text-ink">Dodaj trening</Text>
          <Text className="mt-1 text-xs text-muted">MMA, snaga, kardio</Text>
          <Plus size={17} color="#FF2D55" style={{ position: "absolute", right: 16, top: 17 }} />
        </Pressable>
      </View>
      <Pressable onPress={() => router.push("/weight")} className="mb-3 mt-3 rounded-2xl px-1 py-2">
        <Text className="text-sm font-semibold text-brand">Zabilježi današnju težinu  →</Text>
      </Pressable>
      <Pressable
        onPress={() => router.push("/sleep")}
        className="mb-2 flex-row items-center rounded-2xl bg-white p-4"
      >
        <View className="mr-3 h-10 w-10 items-center justify-center rounded-2xl bg-blush">
          <Moon size={20} color="#FF2D55" />
        </View>
        <View className="flex-1">
          <Text className="font-bold text-ink">Prati san</Text>
          <Text className="mt-1 text-xs text-muted">Zabilježi odmor i kvalitet sna</Text>
        </View>
        <ArrowUpRight size={17} color="#FF2D55" />
      </Pressable>
      <SectionTitle title="Današnji koraci" action={`Cilj ${DAILY_STEP_GOAL.toLocaleString()}`} />
      <Card>
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-3">
            <View className="h-11 w-11 items-center justify-center rounded-2xl bg-blush">
              <Footprints size={21} color="#FF2D55" />
            </View>
            <View>
              <Text className="text-2xl font-extrabold text-ink">{stepCount.toLocaleString()}</Text>
              <Text className="text-xs text-muted">od {DAILY_STEP_GOAL.toLocaleString()} koraka</Text>
            </View>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Sinhronizuj korake"
            onPress={() => void syncSensorSteps()}
            disabled={stepLoading || stepSaving}
            className="flex-row items-center gap-2 rounded-2xl bg-blush px-3 py-2.5"
          >
            {stepLoading
              ? <ActivityIndicator size="small" color="#FF2D55" />
              : <RefreshCw size={16} color="#FF2D55" />}
            <Text className="text-xs font-bold text-brand">Sinhronizuj</Text>
          </Pressable>
        </View>
        <View className="mt-5 h-2 overflow-hidden rounded-full bg-blush">
          <View
            className="h-full rounded-full bg-brand"
            style={{ width: `${Math.min(100, (stepCount / DAILY_STEP_GOAL) * 100)}%` }}
          />
        </View>
        {sensorUnavailable && (
          <View className="mt-4">
            <Text className="mb-2 text-sm font-semibold text-ink">Ručni unos koraka</Text>
            <View className="flex-row gap-2">
              <TextInput
                className="min-h-12 flex-1 rounded-2xl bg-canvas px-4 py-3 text-ink"
                placeholder="npr. 8450"
                placeholderTextColor="#98989F"
                keyboardType="number-pad"
                value={manualSteps}
                onChangeText={(value) => {
                  setManualSteps(value);
                  setStepError(null);
                }}
                editable={!stepSaving}
              />
              <Pressable
                accessibilityRole="button"
                onPress={() => void saveManualSteps()}
                disabled={stepSaving}
                className={`items-center justify-center rounded-2xl bg-brand px-4 ${stepSaving ? "opacity-50" : ""}`}
              >
                <Text className="text-sm font-bold text-white">{stepSaving ? "..." : "Spremi"}</Text>
              </Pressable>
            </View>
          </View>
        )}
        {stepError ? <Text accessibilityRole="alert" className="mt-3 text-sm leading-5 text-[#B4233A]">{stepError}</Text> : null}
        {stepMessage ? <Text className="mt-3 text-sm text-[#247A43]">{stepMessage}</Text> : null}
      </Card>
    </AppScreen>
  );
}
