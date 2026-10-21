import { useCallback, useState } from "react";
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { Clock3, Heart, Plus, Salad, X, PenLine } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { AppScreen, Card, DataErrorState, ErrorMessage, Header, LoadingState, PrimaryButton, SectionTitle } from "@/components/ui";
import { createMeal, formatLocalTime, getDataErrorMessage, listMeals, localDateTimeToIso, localTimeFromTimestamp, setMealFavorite, todayLocal, updateMealTime } from "@/lib/data";
import MealPhotoPicker, { type MealPhoto } from "@/components/MealPhotoPicker";
import { supabase } from "@/lib/supabase";
import type { Meal } from "@/lib/types";

type MealAnalysis = {
  meal_name: string;
  calories: string;
  protein: string;
  carbs: string;
  fats: string;
  weight_g: string;
  advice: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseMealAnalysis(value: unknown): MealAnalysis {
  const record = isRecord(value) && isRecord(value.meal) ? value.meal : value;
  if (!isRecord(record) || typeof record.meal_name !== "string" || !record.meal_name.trim()) {
    throw new Error("AI analiza nije vratila ispravan naziv obroka. Pokušaj s jasnijom fotografijom.");
  }

  const nutritionKeys = ["calories", "protein", "carbs", "fats", "weight_g"] as const;
  const nutrition = Object.fromEntries(nutritionKeys.map((key) => {
    const amount = Number(record[key]);
    if (!Number.isFinite(amount) || amount < 0) {
      throw new Error("AI analiza nije vratila ispravne nutritivne vrijednosti. Pokušaj ponovo.");
    }
    return [key, String(amount)];
  })) as Record<(typeof nutritionKeys)[number], string>;

  const adviceValue = record.advice ?? record.ai_advice ?? record.opinion;
  return {
    meal_name: record.meal_name.trim(),
    ...nutrition,
    advice: typeof adviceValue === "string" && adviceValue.trim()
      ? adviceValue.trim()
      : "Provjeri procijenjenu gramažu i prilagodi nutritivne vrijednosti prije spremanja."
  };
}

async function getMealAnalysisErrorMessage(error: unknown) {
  if (isRecord(error) && error.context instanceof Response) {
    try {
      const payload: unknown = await error.context.clone().json();
      if (isRecord(payload)) {
        const message = typeof payload.error === "string" ? payload.error : null;
        const details = typeof payload.details === "string" ? payload.details : null;
        if (message) return details ? `${message} ${details}` : message;
      }
    } catch {
      // Fall back to the Supabase error when the response body is not JSON.
    }
  }

  const message = error instanceof Error ? error.message : "";
  if (message.includes("Failed to send a request to the Edge Function")) {
    return "Ne mogu povezati BeMove sa funkcijom analyze-meal. Provjeri deploy funkcije, Supabase URL i internet vezu.";
  }
  return getDataErrorMessage(error);
}

export default function MealsScreen() {
  const [meals, setMeals] = useState<Meal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [showMealOptions, setShowMealOptions] = useState(false);
  const [name, setName] = useState("");
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [mealTime, setMealTime] = useState(() => localTimeFromTimestamp(new Date().toISOString()));
  const [selectedPhoto, setSelectedPhoto] = useState<MealPhoto | null>(null);
  const [mealAnalysis, setMealAnalysis] = useState<MealAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [savingAnalysis, setSavingAnalysis] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [quickAddingMealId, setQuickAddingMealId] = useState<string | null>(null);
  const [quickAddMessage, setQuickAddMessage] = useState<string | null>(null);

  const load = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error) throw error;
      setMeals(await listMeals(data.user.id));
    } catch (error) {
      setError(getDataErrorMessage(error));
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  async function analyzePhoto(photo: MealPhoto) {
    setMealTime(localTimeFromTimestamp(new Date().toISOString()));
    setSelectedPhoto(photo);
    setMealAnalysis(null);
    setAnalysisError(null);
    setAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke("analyze-meal", {
        body: { imageBase64: photo.imageBase64, mimeType: photo.mimeType }
      });
      if (error) throw error;
      const analysis = parseMealAnalysis(data);
      setMealAnalysis(analysis);
    } catch (error) {
      setAnalysisError(await getMealAnalysisErrorMessage(error));
    } finally {
      setAnalyzing(false);
    }
  }

  function updateAnalysis(field: Exclude<keyof MealAnalysis, "advice">, value: string) {
    setMealAnalysis((current) => current ? { ...current, [field]: value } : current);
  }

  async function saveAnalyzedMeal() {
    if (!mealAnalysis) return;
    const nutritionKeys = ["calories", "protein", "carbs", "fats", "weight_g"] as const;
    const nutrition = Object.fromEntries(nutritionKeys.map((key) => [key, Number(mealAnalysis[key])])) as Record<(typeof nutritionKeys)[number], number>;
    if (
      !mealAnalysis.meal_name.trim() ||
      Object.values(nutrition).some((value) => !Number.isFinite(value) || value < 0) ||
      nutrition.weight_g <= 0
    ) {
      setAnalysisError("Unesi naziv obroka i procijenjenu gramažu veću od nule.");
      return;
    }

    setSavingAnalysis(true);
    setAnalysisError(null);
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!authData.user) throw new Error("Prijavi se ponovo da bi sačuvao/la obrok.");

      const { error } = await supabase.from("meals").insert({
        user_id: authData.user.id,
        meal_name: mealAnalysis.meal_name.trim(),
        name: mealAnalysis.meal_name.trim(),
        calories: Math.round(nutrition.calories),
        protein: nutrition.protein,
        protein_g: Math.round(nutrition.protein),
        carbs: nutrition.carbs,
        fats: nutrition.fats,
        weight_g: nutrition.weight_g,
        meal_date: todayLocal(),
        created_at: localDateTimeToIso(todayLocal(), mealTime),
        is_favorite: false
      });
      if (error) throw error;

      setMealAnalysis(null);
      setSelectedPhoto(null);
      await load();
    } catch (error) {
      setAnalysisError(`Obrok nije sačuvan: ${getDataErrorMessage(error)}`);
    } finally {
      setSavingAnalysis(false);
    }
  }

  async function addMeal() {
    const kcal = Number(calories);
    const grams = Number(protein || 0);
    if (!name.trim() || !Number.isFinite(kcal) || kcal <= 0 || !Number.isFinite(grams) || grams < 0) {
      setActionError("Provjeri unos: naziv i kalorije su obavezni, a kalorije moraju biti veće od nule.");
      return;
    }
    setActionError(null);
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error) throw error;
      await createMeal(data.user.id, {
        name: name.trim(),
        calories: Math.round(kcal),
        protein_g: Math.round(grams),
        meal_date: todayLocal(),
        created_at: localDateTimeToIso(todayLocal(), mealTime)
      });
      setName(""); setCalories(""); setProtein(""); setAdding(false);
      setMealTime(localTimeFromTimestamp(new Date().toISOString()));
      await load();
    } catch (error) {
      setActionError(`Obrok nije sačuvan: ${getDataErrorMessage(error)}`);
    }
  }

  async function toggleFavorite(meal: Meal) {
    setActionError(null);
    try {
      await setMealFavorite(meal.id, !meal.is_favorite);
      await load();
    } catch (error) {
      setActionError(`Promjena nije sačuvana: ${getDataErrorMessage(error)}`);
    }
  }

  async function quickAddFavorite(meal: Meal) {
    setQuickAddingMealId(meal.id);
    setQuickAddMessage(null);
    setActionError(null);
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error) throw error;
      if (!data.user) throw new Error("Sesija je istekla. Prijavi se ponovo.");

      await createMeal(data.user.id, {
        name: meal.name,
        meal_name: meal.meal_name ?? meal.name,
        calories: meal.calories,
        protein_g: meal.protein_g,
        protein: meal.protein ?? meal.protein_g,
        carbs: meal.carbs ?? 0,
        fats: meal.fats ?? 0,
        weight_g: meal.weight_g ?? 0,
        meal_date: todayLocal(),
        created_at: new Date().toISOString()
      });
      await load(false);
      setQuickAddMessage(`${meal.meal_name ?? meal.name} dodano u današnje unose!`);
    } catch (error) {
      setActionError(`Omiljeno jelo nije dodano: ${getDataErrorMessage(error)}`);
    } finally {
      setQuickAddingMealId(null);
    }
  }

  async function saveMealTime(meal: Meal, time: string): Promise<boolean> {
    try {
      const createdAt = localDateTimeToIso(meal.meal_date, time);
      await updateMealTime(meal.id, createdAt);
      await load(false);
      setActionError(null);
      return true;
    } catch (error) {
      setActionError(`Vrijeme obroka nije ažurirano: ${getDataErrorMessage(error)}`);
      return false;
    }
  }

  if (loading) return <AppScreen><LoadingState /></AppScreen>;
  if (error) return <AppScreen><DataErrorState message={error} onRetry={() => void load()} /></AppScreen>;
  const favorites = meals.filter((meal) => meal.is_favorite);
  const todayCalories = meals.filter((meal) => meal.meal_date === todayLocal()).reduce((sum, meal) => sum + meal.calories, 0);

  return (
    <AppScreen>
      <Header title="Obroci" subtitle="GORIVO ZA TVOJ DAN" />
      {actionError ? <ErrorMessage message={actionError} /> : null}
      {analysisError && !mealAnalysis ? <ErrorMessage message={analysisError} /> : null}
      <Card className="flex-row items-center bg-[#1C1C1E]">
        <View className="flex-1">
          <Text className="text-sm text-white/70">Danas evidentirano</Text>
          <Text className="mt-1 text-3xl font-extrabold text-white">{todayCalories} <Text className="text-sm font-semibold text-white/70">kcal</Text></Text>
        </View>
        <Salad size={27} color="#FF6682" />
      </Card>
      <Modal
        visible={showMealOptions}
        transparent
        animationType="slide"
        onRequestClose={() => setShowMealOptions(false)}
      >
        <View className="flex-1 justify-end bg-black/40">
          <View className="rounded-t-[32px] bg-canvas px-5 pb-8 pt-4">
            <View className="mb-5 flex-row items-center justify-between">
              <View>
                <Text className="text-xl font-extrabold text-ink">Dodaj obrok</Text>
                <Text className="mt-1 text-sm text-muted">Izaberi kako želiš zabilježiti obrok.</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Zatvori opcije dodavanja obroka"
                onPress={() => setShowMealOptions(false)}
                className="rounded-full bg-white p-2"
              >
                <X size={20} color="#1C1C1E" />
              </Pressable>
            </View>
            <MealPhotoPicker
              disabled={analyzing || savingAnalysis}
              onPhoto={(photo) => {
                setShowMealOptions(false);
                void analyzePhoto(photo);
              }}
              onError={(message) => {
                setAnalysisError(message);
                setShowMealOptions(false);
              }}
            />
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setMealTime(localTimeFromTimestamp(new Date().toISOString()));
                setAdding(true);
                setShowMealOptions(false);
              }}
              className="mt-3 flex-row items-center gap-4 rounded-2xl bg-white p-4"
            >
              <View className="h-11 w-11 items-center justify-center rounded-2xl bg-blush">
                <PenLine size={20} color="#FF2D55" />
              </View>
              <View className="flex-1">
                <Text className="font-bold text-ink">Ručni unos</Text>
                <Text className="mt-1 text-xs text-muted">Unesi naziv, kalorije i proteine</Text>
              </View>
              <Plus size={18} color="#FF2D55" />
            </Pressable>
          </View>
        </View>
      </Modal>
      {analyzing && (
        <Modal visible transparent animationType="fade" onRequestClose={() => undefined}>
          <View className="flex-1 items-center justify-center bg-black/40 px-6">
            <View className="w-full items-center rounded-3xl bg-white p-7">
              <ActivityIndicator size="large" color="#FF2D55" />
              <Text className="mt-4 text-center text-base font-bold text-ink">
                BeMove AI analizira tvoj obrok...
              </Text>
              <Text className="mt-2 text-center text-sm text-muted">Procjenjujemo gramažu i nutritivne vrijednosti.</Text>
            </View>
          </View>
        </Modal>
      )}
      <Modal
        visible={mealAnalysis !== null && selectedPhoto !== null}
        transparent
        animationType="slide"
        onRequestClose={() => {
          if (!savingAnalysis) {
            setMealAnalysis(null);
            setSelectedPhoto(null);
            setAnalysisError(null);
          }
        }}
      >
        <View className="flex-1 justify-end bg-black/40">
          <View className="max-h-[92%] rounded-t-3xl bg-canvas px-5 pb-8 pt-4">
            <View className="mb-3 flex-row items-center justify-between">
              <Text className="text-xl font-extrabold text-ink">Procjena obroka</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Zatvori procjenu"
                disabled={savingAnalysis}
                onPress={() => {
                  setMealAnalysis(null);
                  setSelectedPhoto(null);
                  setAnalysisError(null);
                }}
                className="rounded-full bg-white p-2"
              >
                <X size={20} color="#1C1C1E" />
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {selectedPhoto && (
                <Image source={{ uri: selectedPhoto.uri }} className="h-44 w-full rounded-2xl bg-[#EFEFF2]" resizeMode="cover" />
              )}
              {mealAnalysis && (
                <View className="mt-4 gap-3">
                  <View>
                    <Text className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted">Naziv obroka</Text>
                    <TextInput
                      className="rounded-2xl bg-white px-4 py-3 font-semibold text-ink"
                      value={mealAnalysis.meal_name}
                      onChangeText={(value) => updateAnalysis("meal_name", value)}
                      editable={!savingAnalysis}
                      maxLength={120}
                    />
                  </View>
                  <TimeInput label="Vrijeme obroka (HH:MM)" value={mealTime} onChange={setMealTime} />
                  <View className="flex-row flex-wrap gap-3">
                    <NutritionField label="Kalorije" unit="kcal" value={mealAnalysis.calories} onChange={(value) => updateAnalysis("calories", value)} disabled={savingAnalysis} />
                    <NutritionField label="Proteini" unit="g" value={mealAnalysis.protein} onChange={(value) => updateAnalysis("protein", value)} disabled={savingAnalysis} />
                    <NutritionField label="Ugljikohidrati" unit="g" value={mealAnalysis.carbs} onChange={(value) => updateAnalysis("carbs", value)} disabled={savingAnalysis} />
                    <NutritionField label="Masti" unit="g" value={mealAnalysis.fats} onChange={(value) => updateAnalysis("fats", value)} disabled={savingAnalysis} />
                    <NutritionField label="Gramaža" unit="g" value={mealAnalysis.weight_g} onChange={(value) => updateAnalysis("weight_g", value)} disabled={savingAnalysis} />
                  </View>
                  <Card className="bg-blush">
                    <Text className="text-xs font-bold uppercase tracking-wider text-brand">BeMove AI savjet</Text>
                    <Text className="mt-2 text-sm leading-5 text-ink">{mealAnalysis.advice}</Text>
                  </Card>
                  {analysisError ? <ErrorMessage message={analysisError} /> : null}
                  <PrimaryButton
                    label={savingAnalysis ? "Spremanje..." : "Spremi obrok"}
                    onPress={() => void saveAnalyzedMeal()}
                    disabled={savingAnalysis}
                  />
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
      <Pressable
        accessibilityRole="button"
        onPress={() => setShowMealOptions(true)}
        className="mt-5 overflow-hidden rounded-2xl"
        style={{ shadowColor: "#E60023", shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.2, shadowRadius: 10, elevation: 4 }}
      >
        <LinearGradient colors={["#FF3B30", "#FF6B00"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} className="flex-row items-center justify-center gap-2 py-4">
          <Plus size={20} color="white" />
          <Text className="font-bold text-white">Dodaj obrok</Text>
        </LinearGradient>
      </Pressable>
      <Modal
        visible={adding}
        transparent
        animationType="slide"
        onRequestClose={() => setAdding(false)}
      >
        <View className="flex-1 justify-end bg-black/40">
          <View className="max-h-[88%] rounded-t-[32px] bg-canvas px-5 pb-8 pt-4">
            <View className="mb-4 flex-row items-center justify-between">
              <Text className="text-xl font-extrabold text-ink">Ručni unos</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Zatvori ručni unos" onPress={() => setAdding(false)} className="rounded-full bg-white p-2">
                <X size={20} color="#1C1C1E" />
              </Pressable>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <View className="gap-3 pb-4">
                <TextInput className="rounded-2xl bg-white px-4 py-3 text-ink" placeholder="Naziv obroka" placeholderTextColor="#98989F" value={name} onChangeText={setName} />
                <TimeInput label="Vrijeme unosa (HH:MM)" value={mealTime} onChange={setMealTime} />
                <View className="flex-row gap-3">
                  <TextInput className="flex-1 rounded-2xl bg-white px-4 py-3 text-ink" placeholder="Kalorije" placeholderTextColor="#98989F" keyboardType="numeric" value={calories} onChangeText={setCalories} />
                  <TextInput className="flex-1 rounded-2xl bg-white px-4 py-3 text-ink" placeholder="Proteini (g)" placeholderTextColor="#98989F" keyboardType="numeric" value={protein} onChangeText={setProtein} />
                </View>
                {actionError ? <ErrorMessage message={actionError} /> : null}
                <PrimaryButton label="Sačuvaj obrok" onPress={() => void addMeal()} />
                <Pressable onPress={() => setAdding(false)} className="items-center py-2"><Text className="font-semibold text-muted">Odustani</Text></Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
      <SectionTitle title="Omiljena jela" />
      {quickAddMessage ? (
        <Text accessibilityRole="alert" className="mb-3 rounded-2xl bg-[#EAF7EF] px-4 py-3 text-sm font-semibold text-[#247A43]">
          {quickAddMessage}
        </Text>
      ) : null}
      {favorites.length === 0 ? (
        <Card><Text className="text-sm leading-5 text-muted">Označi obrok srcem da bi ga sačuvao/la kao omiljeni.</Text></Card>
      ) : favorites.map((meal) => (
        <MealRow
          key={meal.id}
          meal={meal}
          onFavorite={() => toggleFavorite(meal)}
          onQuickAdd={() => void quickAddFavorite(meal)}
          quickAdding={quickAddingMealId === meal.id}
          quickAddDisabled={quickAddingMealId !== null}
        />
      ))}
      <SectionTitle title="Nedavni unosi" />
      {meals.length === 0 ? <Card><Text className="text-sm text-muted">Još nema unesenih obroka. Dodaj prvi obrok iznad.</Text></Card> : meals.map((meal) => (
        <MealRow key={meal.id} meal={meal} onFavorite={() => toggleFavorite(meal)} onSaveTime={(time) => saveMealTime(meal, time)} />
      ))}
    </AppScreen>
  );
}

function MealRow({
  meal,
  onFavorite,
  onQuickAdd,
  quickAdding = false,
  quickAddDisabled = false,
  onSaveTime
}: {
  meal: Meal;
  onFavorite: () => void;
  onQuickAdd?: () => void;
  quickAdding?: boolean;
  quickAddDisabled?: boolean;
  onSaveTime?: (time: string) => Promise<boolean>;
}) {
  const [editingTime, setEditingTime] = useState(false);
  const [time, setTime] = useState(() => localTimeFromTimestamp(meal.created_at));
  const [savingTime, setSavingTime] = useState(false);

  async function saveTime() {
    if (!onSaveTime) return;
    setSavingTime(true);
    try {
      if (await onSaveTime(time)) setEditingTime(false);
    } finally {
      setSavingTime(false);
    }
  }

  return (
    <Card className="mb-3 flex-row items-center">
      <View className="mr-3 h-11 w-11 items-center justify-center rounded-2xl bg-blush"><Salad size={20} color="#FF2D55" /></View>
      <View className="flex-1">
        <Text className="font-bold text-ink">{meal.meal_name ?? meal.name}</Text>
        <Text className="mt-1 text-xs text-muted">{meal.calories} kcal  ·  {meal.protein_g} g proteina</Text>
        <Text className="mt-1 text-xs text-muted">Vrijeme: {formatLocalTime(meal.created_at)}</Text>
        {meal.weight_g ? <Text className="mt-1 text-xs text-muted">{meal.weight_g} g  ·  UH {meal.carbs ?? 0} g  ·  masti {meal.fats ?? 0} g</Text> : null}
        {onSaveTime && editingTime ? (
          <View className="mt-2 flex-row items-center gap-2">
            <TextInput
              className="rounded-xl bg-canvas px-3 py-2 text-sm text-ink"
              accessibilityLabel="Vrijeme obroka u formatu sati i minute"
              placeholder="HH:MM"
              value={time}
              onChangeText={setTime}
              maxLength={5}
            />
            <Pressable accessibilityRole="button" onPress={() => void saveTime()} disabled={savingTime}>
              <Text className="text-xs font-bold text-brand">{savingTime ? "..." : "Sačuvaj"}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => setEditingTime(false)} disabled={savingTime}>
              <Text className="text-xs font-semibold text-muted">Odustani</Text>
            </Pressable>
          </View>
        ) : onSaveTime ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setTime(localTimeFromTimestamp(meal.created_at));
              setEditingTime(true);
            }}
            className="mt-2 flex-row items-center gap-1"
          >
            <Clock3 size={13} color="#FF2D55" />
            <Text className="text-xs font-semibold text-brand">Uredi vrijeme</Text>
          </Pressable>
        ) : null}
      </View>
      <View className="flex-row items-center gap-4">
        {onQuickAdd ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Dodaj ${meal.meal_name ?? meal.name} u današnje unose`}
            onPress={onQuickAdd}
            disabled={quickAddDisabled}
            hitSlop={10}
            className={`h-9 w-9 items-center justify-center rounded-full bg-blush ${quickAddDisabled ? "opacity-50" : ""}`}
          >
            {quickAdding
              ? <ActivityIndicator size="small" color="#FF2D55" />
              : <Plus size={19} color="#FF2D55" />}
          </Pressable>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={meal.is_favorite ? "Ukloni iz omiljenih" : "Dodaj u omiljena"}
          onPress={onFavorite}
          hitSlop={10}
        >
          <Heart size={20} color={meal.is_favorite ? "#FF2D55" : "#B8B8BE"} fill={meal.is_favorite ? "#FF2D55" : "transparent"} />
        </Pressable>
      </View>
    </Card>
  );
}

function NutritionField({
  label,
  unit,
  value,
  onChange,
  disabled
}: {
  label: string;
  unit: string;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
}) {
  return (
    <View className="w-[47%]">
      <Text className="mb-1 text-xs font-semibold text-muted">{label} ({unit})</Text>
      <TextInput
        className="rounded-2xl bg-white px-4 py-3 font-semibold text-ink"
        keyboardType="decimal-pad"
        value={String(value)}
        onChangeText={onChange}
        editable={!disabled}
      />
    </View>
  );
}

function TimeInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <View className="flex-row items-center justify-between rounded-2xl bg-canvas px-4 py-2">
      <Text className="text-sm font-semibold text-ink">{label}</Text>
      <TextInput
        accessibilityLabel={label}
        className="min-w-20 rounded-xl bg-white px-3 py-2 text-center font-semibold text-ink"
        placeholder="HH:MM"
        placeholderTextColor="#98989F"
        value={value}
        onChangeText={onChange}
        maxLength={5}
      />
    </View>
  );
}
