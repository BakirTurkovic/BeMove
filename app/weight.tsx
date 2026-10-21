import { useCallback, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import Svg, { Circle, Line, Polyline, Text as SvgText } from "react-native-svg";
import { ArrowUpRight, Scale, TrendingDown } from "lucide-react-native";
import { AppScreen, Card, DataErrorState, ErrorMessage, Header, LoadingState, Metric, PrimaryButton, SectionTitle } from "@/components/ui";
import { createWeightLog, getDataErrorMessage, getProfile, listWeightLogs, saveProfile } from "@/lib/data";
import { supabase } from "@/lib/supabase";
import type { WeightLog } from "@/lib/types";

export default function WeightScreen() {
  const [logs, setLogs] = useState<WeightLog[]>([]);
  const [target, setTarget] = useState(115);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [weight, setWeight] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error) throw error;
      const [entries, profile] = await Promise.all([listWeightLogs(data.user.id), getProfile(data.user.id)]);
      setLogs(entries);
      setTarget(profile.target_weight_kg);
    } catch (error) {
      setError(getDataErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  async function saveWeight() {
    const value = Number(weight);
    if (!Number.isFinite(value) || value < 25 || value > 400) {
      setActionError("Provjeri unos: unesi težinu između 25 i 400 kg.");
      return;
    }
    setActionError(null);
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error) throw error;
      const profile = await getProfile(data.user.id);
      await Promise.all([
        createWeightLog(data.user.id, value),
        profile.starting_weight_kg === null ? saveProfile(data.user.id, { starting_weight_kg: value }) : Promise.resolve()
      ]);
      setWeight("");
      await load();
    } catch (error) {
      setActionError(`Težina nije sačuvana: ${getDataErrorMessage(error)}`);
    }
  }

  if (loading) return <AppScreen><LoadingState /></AppScreen>;
  if (error) return <AppScreen><DataErrorState message={error} onRetry={() => void load()} /></AppScreen>;
  const current = logs[logs.length - 1]?.weight_kg;
  const first = logs[0]?.weight_kg;
  const change = first !== undefined && current !== undefined ? first - current : 0;

  return (
    <AppScreen>
      <Header title="Težina" subtitle="MALI KORACI, VELIKA PROMJENA" />
      {actionError ? <ErrorMessage message={actionError} /> : null}
      <Card className="bg-brand">
        <View className="flex-row items-start justify-between">
          <View><Text className="text-sm font-semibold text-white/80">Tvoja trenutna težina</Text><Text className="mt-2 text-5xl font-extrabold text-white">{current?.toFixed(1) ?? "—"} <Text className="text-lg">kg</Text></Text></View>
          <View className="rounded-2xl bg-white/20 p-3"><Scale size={24} color="white" /></View>
        </View>
        <View className="mt-5 flex-row gap-8"><Text className="text-xs text-white/85">CILJ  {target} kg</Text><Text className="text-xs text-white/85">PROMJENA  {change >= 0 ? "−" : "+"}{Math.abs(change).toFixed(1)} kg</Text></View>
      </Card>
      <SectionTitle title="Zabilježi težinu" />
      <Card>
        <Text className="mb-3 text-sm text-muted">Za najbolje praćenje mjeri se u slično doba dana.</Text>
        <View className="flex-row gap-3">
          <TextInput className="flex-1 rounded-2xl bg-canvas px-4 py-4 text-lg font-bold text-ink" placeholder="npr. 118.5 kg" placeholderTextColor="#98989F" keyboardType="decimal-pad" value={weight} onChangeText={(text) => setWeight(text.replace(",", "."))} />
          <View className="w-[130px]"><PrimaryButton label="Sačuvaj" onPress={saveWeight} /></View>
        </View>
      </Card>
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push("/measurements")}
        className="mt-4 flex-row items-center rounded-3xl bg-white p-4"
      >
        <View className="mr-3 h-10 w-10 items-center justify-center rounded-2xl bg-blush">
          <Scale size={19} color="#FF2D55" />
        </View>
        <View className="flex-1">
          <Text className="font-bold text-ink">Obimi tijela</Text>
          <Text className="mt-1 text-xs text-muted">Struk, prsa, ruke, kukovi i noge</Text>
        </View>
        <ArrowUpRight size={18} color="#FF2D55" />
      </Pressable>
      <SectionTitle title="Trend težine" />
      <Card>
        {logs.length < 2 ? (
          <View className="items-center py-8"><TrendingDown size={25} color="#FF2D55" /><Text className="mt-3 text-center text-sm leading-5 text-muted">Dodaj još jedno mjerenje da prikažeš trend težine.</Text></View>
        ) : <WeightChart logs={logs.slice(-7)} />}
      </Card>
      <SectionTitle title="Posljednja mjerenja" />
      {logs.slice(-7).reverse().map((entry) => (
        <Card key={entry.id} className="mb-3 flex-row items-center justify-between">
          <View><Text className="font-bold text-ink">{new Date(entry.logged_at).toLocaleDateString()}</Text><Text className="mt-1 text-xs text-muted">Mjerenje težine</Text></View>
          <Text className="text-lg font-extrabold text-ink">{entry.weight_kg.toFixed(1)} <Text className="text-xs text-muted">kg</Text></Text>
        </Card>
      ))}
    </AppScreen>
  );
}

function WeightChart({ logs }: { logs: WeightLog[] }) {
  const width = 300;
  const height = 160;
  const values = logs.map((entry) => entry.weight_kg);
  const min = Math.min(...values) - 1;
  const max = Math.max(...values) + 1;
  const points = values.map((value, index) => {
    const x = 12 + (index / Math.max(1, values.length - 1)) * (width - 24);
    const y = 18 + ((max - value) / Math.max(1, max - min)) * (height - 42);
    return `${x},${y}`;
  }).join(" ");

  return (
    <View className="items-center">
      <View className="flex-row self-stretch justify-between"><Metric label="Početak" value={values[0].toFixed(1)} unit="kg" /><Metric label="Sada" value={values[values.length - 1].toFixed(1)} unit="kg" /></View>
      <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
        <Line x1="12" y1={height - 22} x2={width - 12} y2={height - 22} stroke="#EFEFF2" strokeWidth="1" />
        <Polyline points={points} fill="none" stroke="#FF2D55" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        {points.split(" ").map((point, index) => {
          const [cx, cy] = point.split(",");
          return <Circle key={index} cx={cx} cy={cy} r="4" fill="#FF2D55" stroke="white" strokeWidth="2" />;
        })}
        <SvgText x={12} y={height - 5} fill="#98989F" fontSize="9">Prije</SvgText>
        <SvgText x={width - 28} y={height - 5} fill="#98989F" fontSize="9">Sada</SvgText>
      </Svg>
    </View>
  );
}
