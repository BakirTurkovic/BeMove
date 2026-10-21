import { useCallback, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { Ruler } from "lucide-react-native";
import { AppScreen, Card, DataErrorState, ErrorMessage, Header, LoadingState, PrimaryButton, SectionTitle } from "@/components/ui";
import { createBodyMeasurement, getDataErrorMessage, listBodyMeasurements, todayLocal } from "@/lib/data";
import { supabase } from "@/lib/supabase";
import type { BodyMeasurement } from "@/lib/types";

type MeasurementKey = "waist_cm" | "arm_cm" | "chest_cm" | "hips_cm" | "thigh_cm";
type MeasurementValues = Record<MeasurementKey, string>;

const fields: { key: MeasurementKey; label: string; positiveDirection: "up" | "down" }[] = [
  { key: "waist_cm", label: "Struk", positiveDirection: "down" },
  { key: "arm_cm", label: "Ruka / Biceps", positiveDirection: "up" },
  { key: "chest_cm", label: "Prsa", positiveDirection: "up" },
  { key: "hips_cm", label: "Kukovi", positiveDirection: "down" },
  { key: "thigh_cm", label: "Noga / Natkoljenica", positiveDirection: "down" }
];

const emptyValues: MeasurementValues = {
  waist_cm: "",
  arm_cm: "",
  chest_cm: "",
  hips_cm: "",
  thigh_cm: ""
};

function isValidDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

function formatDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("bs-BA", { day: "numeric", month: "long", year: "numeric" })
    .format(new Date(year, month - 1, day));
}

export default function MeasurementsScreen() {
  const [entries, setEntries] = useState<BodyMeasurement[]>([]);
  const [values, setValues] = useState<MeasurementValues>({ ...emptyValues });
  const [date, setDate] = useState(todayLocal());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!data.user) throw new Error("Sesija je istekla. Prijavi se ponovo.");
      setEntries(await listBodyMeasurements(data.user.id));
    } catch (loadError) {
      setError(getDataErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    void load();
  }, [load]));

  function updateValue(key: MeasurementKey, value: string) {
    setValues((current) => ({ ...current, [key]: value.replace(",", ".") }));
    setActionError(null);
    setSuccess(null);
  }

  async function saveMeasurement() {
    if (!isValidDate(date)) {
      setActionError("Unesi datum u formatu YYYY-MM-DD.");
      setSuccess(null);
      return;
    }

    const parsed = Object.fromEntries(fields.map(({ key }) => {
      const raw = values[key].trim();
      if (!raw) return [key, null];
      const value = Number(raw);
      return [key, Number.isFinite(value) && value > 0 && value <= 300 ? value : Number.NaN];
    })) as Record<MeasurementKey, number | null>;

    if (Object.values(parsed).every((value) => value === null)) {
      setActionError("Unesi barem jedan obim.");
      setSuccess(null);
      return;
    }
    if (Object.values(parsed).some((value) => value !== null && !Number.isFinite(value))) {
      setActionError("Obimi moraju biti brojevi veći od 0 i najviše 300 cm.");
      setSuccess(null);
      return;
    }

    setSaving(true);
    setActionError(null);
    setSuccess(null);
    try {
      const { data, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!data.user) throw new Error("Sesija je istekla. Prijavi se ponovo.");
      await createBodyMeasurement(data.user.id, { ...parsed, date });
      setValues({ ...emptyValues });
      setSuccess("Obimi su uspješno sačuvani.");
      await load();
    } catch (saveError) {
      setActionError(`Obimi nisu sačuvani: ${getDataErrorMessage(saveError)}`);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <AppScreen><LoadingState /></AppScreen>;
  if (error) return <AppScreen><DataErrorState message={error} onRetry={() => void load()} /></AppScreen>;

  return (
    <AppScreen>
      <Header title="Obimi tijela" subtitle="PRATI PROMJENE I NAPREDAK" />
      {actionError ? <ErrorMessage message={actionError} /> : null}
      {success ? <Text accessibilityRole="alert" className="mb-4 rounded-2xl bg-[#EAF7EF] px-4 py-3 text-sm font-semibold text-[#247A43]">{success}</Text> : null}

      <SectionTitle title="Novo mjerenje" />
      <Card>
        <Text className="mb-2 text-sm font-semibold text-ink">Datum mjerenja</Text>
        <TextInput
          accessibilityLabel="Datum mjerenja, format godina-mjesec-dan"
          className="mb-4 rounded-2xl bg-canvas px-4 py-3 text-ink"
          value={date}
          onChangeText={(value) => {
            setDate(value);
            setActionError(null);
            setSuccess(null);
          }}
          placeholder="YYYY-MM-DD"
          placeholderTextColor="#98989F"
          maxLength={10}
          autoCapitalize="none"
        />
        {fields.map(({ key, label }) => (
          <View key={key} className="mb-3 flex-row items-center gap-3">
            <Text className="w-32 text-sm font-semibold text-ink">{label}</Text>
            <TextInput
              accessibilityLabel={`${label} u centimetrima`}
              className="min-h-12 flex-1 rounded-2xl bg-canvas px-4 py-3 text-ink"
              value={values[key]}
              onChangeText={(value) => updateValue(key, value)}
              placeholder="cm"
              placeholderTextColor="#98989F"
              keyboardType="decimal-pad"
            />
            <Text className="text-sm text-muted">cm</Text>
          </View>
        ))}
        <View className="mt-2">
          <PrimaryButton
            label={saving ? "Spremanje..." : "Spremi obime"}
            onPress={() => void saveMeasurement()}
            disabled={saving}
          />
        </View>
      </Card>

      <SectionTitle title="Historija i promjene" />
      {entries.length === 0 ? (
        <Card className="items-center py-8">
          <Ruler size={25} color="#FF2D55" />
          <Text className="mt-3 text-center text-sm leading-5 text-muted">Još nema unesenih obima. Prvo mjerenje će se pojaviti ovdje.</Text>
        </Card>
      ) : entries.map((entry, index) => (
        <Card key={entry.id} className="mb-3">
          <Text className="mb-4 font-bold capitalize text-ink">{formatDate(entry.date)}</Text>
          <View className="gap-3">
            {fields.map(({ key, label, positiveDirection }) => {
              const value = entry[key] === null ? null : Number(entry[key]);
              if (value === null) return null;
              const previous = entries.slice(index + 1).find((candidate) => candidate[key] !== null);
              const previousValue = previous ? Number(previous[key]) : null;
              const change = previousValue === null ? null : value - previousValue;
              const isPositive = change !== null && (positiveDirection === "down" ? change < 0 : change > 0);
              const changeColor = change === null || change === 0 ? "#98989F" : isPositive ? "#247A43" : "#B4233A";
              return (
                <View key={key} className="flex-row items-center justify-between">
                  <Text className="text-sm text-muted">{label}</Text>
                  <View className="flex-row items-center gap-2">
                    {change !== null ? (
                      <Text className="text-xs font-bold" style={{ color: changeColor }}>
                        {change > 0 ? "+" : ""}{change.toFixed(1)} cm
                      </Text>
                    ) : null}
                    <Text className="font-bold text-ink">{value.toFixed(1)} cm</Text>
                  </View>
                </View>
              );
            })}
          </View>
        </Card>
      ))}
      {entries.length >= 100 ? <Text className="mt-1 text-center text-xs text-muted">Prikazano je posljednjih 100 mjerenja.</Text> : null}
    </AppScreen>
  );
}
