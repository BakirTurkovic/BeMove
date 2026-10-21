import { useCallback, useState } from "react";
import { Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { Activity, Clock3, Dumbbell, Flame, Plus, X } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { AppScreen, Card, DataErrorState, ErrorMessage, Header, LoadingState, PrimaryButton, SectionTitle } from "@/components/ui";
import { createWorkout, createWorkoutExercises, formatLocalTime, getDataErrorMessage, listWorkouts, localDateTimeToIso, localTimeFromTimestamp, todayLocal, updateWorkoutTime } from "@/lib/data";
import { supabase } from "@/lib/supabase";
import type { Workout } from "@/lib/types";

const workoutTypes = ["MMA", "Hibridni", "Snaga", "Kardio"] as const;
const caloriesPerMinute: Record<(typeof workoutTypes)[number], number> = { MMA: 11, Hibridni: 9, Snaga: 6, Kardio: 10 };

type SetDraft = { id: string; weight: string; reps: string };
type ExerciseDraft = { id: string; name: string; sets: SetDraft[] };
let draftId = 0;
const nextDraftId = () => `draft-${++draftId}`;
const createSetDraft = (): SetDraft => ({ id: nextDraftId(), weight: "", reps: "" });
const createExerciseDraft = (): ExerciseDraft => ({
  id: nextDraftId(),
  name: "",
  sets: [createSetDraft()]
});

export default function WorkoutsScreen() {
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [duration, setDuration] = useState("");
  const [category, setCategory] = useState<(typeof workoutTypes)[number]>("MMA");
  const [workoutTime, setWorkoutTime] = useState(() => localTimeFromTimestamp(new Date().toISOString()));
  const [exerciseDrafts, setExerciseDrafts] = useState<ExerciseDraft[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error) throw error;
      setWorkouts(await listWorkouts(data.user.id));
    } catch (error) {
      setError(getDataErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  async function addWorkout() {
    const minutes = Number(duration);
    if (!name.trim() || !Number.isFinite(minutes) || minutes < 1 || minutes > 600) {
      setActionError("Provjeri unos: unesi naziv i trajanje treninga od 1 do 600 minuta.");
      return;
    }
    const exercisesToSave: { exercise_name: string; sets: { set_number: number; weight_kg: number; reps: number }[] }[] = [];
    for (const exercise of exerciseDrafts) {
      const exerciseName = exercise.name.trim();
      const hasSetInput = exercise.sets.some((set) => set.weight.trim() || set.reps.trim());
      if (!exerciseName) {
        if (hasSetInput) {
          setActionError("Unesi naziv svake vježbe kojoj dodaješ serije.");
          return;
        }
        continue;
      }
      if (!exercise.sets.length) {
        setActionError(`Dodaj barem jednu seriju za vježbu „${exerciseName}”.`);
        return;
      }
      const sets: { set_number: number; weight_kg: number; reps: number }[] = [];
      for (const [index, set] of exercise.sets.entries()) {
        const weight = Number(set.weight);
        const reps = Number(set.reps);
        if (
          !set.weight.trim() ||
          !set.reps.trim() ||
          !Number.isFinite(weight) ||
          weight < 0 ||
          !Number.isInteger(reps) ||
          reps < 1
        ) {
          setActionError(`Provjeri težinu i ponavljanja u seriji ${index + 1} za „${exerciseName}”.`);
          return;
        }
        sets.push({ set_number: index + 1, weight_kg: weight, reps });
      }
      exercisesToSave.push({ exercise_name: exerciseName, sets });
    }

    setActionError(null);
    let createdWorkoutId: string | null = null;
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error) throw error;
      createdWorkoutId = await createWorkout(data.user.id, {
        title: name.trim(),
        date: todayLocal(),
        category,
        duration_minutes: Math.round(minutes),
        calories_burned: Math.round(minutes * caloriesPerMinute[category]),
        created_at: localDateTimeToIso(todayLocal(), workoutTime)
      });
      if (exercisesToSave.length) {
        await createWorkoutExercises(createdWorkoutId, exercisesToSave);
      }
      createdWorkoutId = null;
      setName(""); setDuration(""); setAdding(false);
      setExerciseDrafts([]);
      setWorkoutTime(localTimeFromTimestamp(new Date().toISOString()));
      await load();
    } catch (error) {
      let message = getDataErrorMessage(error);
      if (createdWorkoutId) {
        const { error: cleanupError } = await supabase.from("workouts").delete().eq("id", createdWorkoutId);
        if (cleanupError) {
          message += ` Također nije bilo moguće ukloniti nepotpuni trening: ${getDataErrorMessage(cleanupError)}`;
        }
      }
      setActionError(`Trening nije sačuvan: ${message}`);
    }
  }

  async function saveWorkoutTime(workout: Workout, time: string): Promise<boolean> {
    try {
      await updateWorkoutTime(workout.id, localDateTimeToIso(workout.date, time));
      setActionError(null);
      await load();
      return true;
    } catch (error) {
      setActionError(`Vrijeme treninga nije ažurirano: ${getDataErrorMessage(error)}`);
      return false;
    }
  }

  if (loading) return <AppScreen><LoadingState /></AppScreen>;
  if (error) return <AppScreen><DataErrorState message={error} onRetry={() => void load()} /></AppScreen>;
  const today = todayLocal();
  const todayWorkouts = workouts.filter((workout) => workout.date === today);
  const calories = todayWorkouts.reduce((sum, workout) => sum + workout.calories_burned, 0);

  return (
    <AppScreen>
      <Header title="Treninzi" subtitle="SNAGA U SVAKOM POKRETU" />
      {actionError ? <ErrorMessage message={actionError} /> : null}
      <Card className="bg-brand">
        <View className="flex-row items-center justify-between">
          <View><Text className="text-sm font-semibold text-white/80">Današnja aktivnost</Text><Text className="mt-2 text-4xl font-extrabold text-white">{calories} <Text className="text-base">kcal</Text></Text></View>
          <View className="rounded-2xl bg-white/20 p-3"><Flame size={25} color="white" /></View>
        </View>
        <Text className="mt-3 text-sm text-white/80">{todayWorkouts.length} treninga  ·  {todayWorkouts.reduce((sum, workout) => sum + workout.duration_minutes, 0)} minuta</Text>
      </Card>
      <Modal visible={adding} transparent animationType="slide" onRequestClose={() => setAdding(false)}>
        <View className="flex-1 justify-end bg-black/40">
          <View className="max-h-[90%] rounded-t-[32px] bg-canvas px-5 pb-8 pt-4">
            <View className="mb-3 flex-row items-center justify-between">
              <View>
                <Text className="text-xl font-extrabold text-ink">Zabilježi trening</Text>
                <Text className="mt-1 text-sm text-muted">Dodaj aktivnost i detalje vježbi.</Text>
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel="Zatvori unos treninga" onPress={() => setAdding(false)} className="rounded-full bg-white p-2">
                <X size={20} color="#1C1C1E" />
              </Pressable>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Card className="mb-3">
          <View className="gap-3">
            <TextInput className="rounded-2xl bg-canvas px-4 py-3 text-ink" placeholder="Naziv treninga" placeholderTextColor="#98989F" value={name} onChangeText={setName} />
            <TextInput className="rounded-2xl bg-canvas px-4 py-3 text-ink" placeholder="Trajanje u minutama" placeholderTextColor="#98989F" keyboardType="numeric" value={duration} onChangeText={setDuration} />
            <View className="flex-row items-center justify-between rounded-2xl bg-canvas px-4 py-2">
              <Text className="text-sm font-semibold text-ink">Vrijeme treninga (HH:MM)</Text>
              <TextInput
                accessibilityLabel="Vrijeme treninga u formatu sati i minute"
                className="min-w-20 rounded-xl bg-white px-3 py-2 text-center font-semibold text-ink"
                placeholder="HH:MM"
                placeholderTextColor="#98989F"
                value={workoutTime}
                onChangeText={setWorkoutTime}
                maxLength={5}
              />
            </View>
            <View className="flex-row flex-wrap gap-2">
              {workoutTypes.map((type) => (
                <Pressable key={type} onPress={() => setCategory(type)} className={`rounded-full px-4 py-2 ${category === type ? "bg-brand" : "bg-canvas"}`}>
                  <Text className={`text-xs font-bold ${category === type ? "text-white" : "text-muted"}`}>{type}</Text>
                </Pressable>
              ))}
            </View>
            <View className="gap-3 rounded-2xl bg-canvas p-3">
              <View className="flex-row items-center justify-between">
                <Text className="font-bold text-ink">Vježbe i serije</Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setExerciseDrafts((current) => [...current, createExerciseDraft()])}
                  className="flex-row items-center gap-1 rounded-full bg-blush px-3 py-2"
                >
                  <Plus size={15} color="#FF2D55" />
                  <Text className="text-xs font-bold text-brand">Dodaj vježbu</Text>
                </Pressable>
              </View>
              {exerciseDrafts.length === 0 ? (
                <Text className="text-xs leading-5 text-muted">Opcionalno zabilježi vježbe, težinu i ponavljanja uz ovaj trening.</Text>
              ) : exerciseDrafts.map((exercise, exerciseIndex) => (
                <View key={exercise.id} className="gap-2 rounded-2xl bg-white p-3">
                  <View className="flex-row items-center gap-2">
                    <TextInput
                      accessibilityLabel={`Naziv vježbe ${exerciseIndex + 1}`}
                      className="flex-1 rounded-xl bg-canvas px-3 py-2 text-sm text-ink"
                      placeholder="Naziv vježbe"
                      placeholderTextColor="#98989F"
                      value={exercise.name}
                      onChangeText={(nameValue) => setExerciseDrafts((current) => current.map((item) => item.id === exercise.id ? { ...item, name: nameValue } : item))}
                    />
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Ukloni vježbu"
                      onPress={() => setExerciseDrafts((current) => current.filter((item) => item.id !== exercise.id))}
                      className="rounded-full p-2"
                    >
                      <X size={16} color="#98989F" />
                    </Pressable>
                  </View>
                  {exercise.sets.map((set, setIndex) => (
                    <View key={set.id} className="flex-row items-center gap-2">
                      <Text className="w-12 text-xs font-semibold text-muted">Serija {setIndex + 1}</Text>
                      <TextInput
                        accessibilityLabel={`Težina serije ${setIndex + 1}, kilogrami`}
                        className="min-w-0 flex-1 rounded-xl bg-canvas px-3 py-2 text-center text-sm text-ink"
                        placeholder="kg"
                        placeholderTextColor="#98989F"
                        keyboardType="decimal-pad"
                        value={set.weight}
                        onChangeText={(weight) => setExerciseDrafts((current) => current.map((item) => item.id === exercise.id ? { ...item, sets: item.sets.map((row) => row.id === set.id ? { ...row, weight } : row) } : item))}
                      />
                      <TextInput
                        accessibilityLabel={`Ponavljanja serije ${setIndex + 1}`}
                        className="min-w-0 flex-1 rounded-xl bg-canvas px-3 py-2 text-center text-sm text-ink"
                        placeholder="pon."
                        placeholderTextColor="#98989F"
                        keyboardType="number-pad"
                        value={set.reps}
                        onChangeText={(reps) => setExerciseDrafts((current) => current.map((item) => item.id === exercise.id ? { ...item, sets: item.sets.map((row) => row.id === set.id ? { ...row, reps } : row) } : item))}
                      />
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Ukloni seriju"
                        disabled={exercise.sets.length <= 1}
                        onPress={() => setExerciseDrafts((current) => current.map((item) => item.id === exercise.id ? { ...item, sets: item.sets.filter((row) => row.id !== set.id) } : item))}
                        className="rounded-full p-2"
                      >
                        <X size={14} color={exercise.sets.length <= 1 ? "#D1D1D6" : "#98989F"} />
                      </Pressable>
                    </View>
                  ))}
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setExerciseDrafts((current) => current.map((item) => item.id === exercise.id ? { ...item, sets: [...item.sets, createSetDraft()] } : item))}
                    className="self-start px-1 py-1"
                  >
                    <Text className="text-xs font-bold text-brand">+ Dodaj seriju</Text>
                  </Pressable>
                </View>
              ))}
            </View>
            {duration ? <Text className="text-xs text-muted">Procjena potrošnje: ~{Math.round((Number(duration) || 0) * caloriesPerMinute[category])} kcal</Text> : null}
            <PrimaryButton label="Sačuvaj trening" onPress={addWorkout} />
            <Pressable onPress={() => setAdding(false)} className="items-center py-2"><Text className="font-semibold text-muted">Odustani</Text></Pressable>
          </View>
        </Card>
            </ScrollView>
          </View>
        </View>
      </Modal>
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          setWorkoutTime(localTimeFromTimestamp(new Date().toISOString()));
          setAdding(true);
        }}
        className="mt-5 overflow-hidden rounded-2xl"
        style={{ shadowColor: "#E60023", shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.2, shadowRadius: 10, elevation: 4 }}
      >
        <LinearGradient colors={["#FF3B30", "#FF6B00"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} className="flex-row items-center justify-center gap-2 py-4">
          <Plus size={20} color="white" /><Text className="font-bold text-white">Dodaj trening</Text>
        </LinearGradient>
      </Pressable>
      <SectionTitle title="Vrste treninga" />
      <View className="flex-row gap-3">
        {workoutTypes.slice(0, 3).map((type, index) => (
          <Card key={type} className="flex-1 items-center px-2 py-4">
            {index === 0 ? <Activity size={21} color="#FF2D55" /> : <Dumbbell size={21} color="#FF2D55" />}
            <Text className="mt-2 text-xs font-bold text-ink">{type}</Text>
          </Card>
        ))}
      </View>
      <SectionTitle title="Nedavni treninzi" />
      {workouts.length === 0 ? <Card><Text className="text-sm text-muted">Još nema treninga. Evidentiraj prvi trening!</Text></Card> : workouts.map((workout) => (
        <WorkoutRow key={workout.id} workout={workout} onSaveTime={(time) => saveWorkoutTime(workout, time)} />
      ))}
    </AppScreen>
  );
}

function WorkoutRow({ workout, onSaveTime }: { workout: Workout; onSaveTime: (time: string) => Promise<boolean> }) {
  const [editingTime, setEditingTime] = useState(false);
  const [time, setTime] = useState(() => localTimeFromTimestamp(workout.created_at));
  const [saving, setSaving] = useState(false);

  async function saveTime() {
    setSaving(true);
    try {
      if (await onSaveTime(time)) setEditingTime(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="mb-3 flex-row items-center">
      <View className="mr-3 h-11 w-11 items-center justify-center rounded-2xl bg-blush"><Dumbbell size={19} color="#FF2D55" /></View>
      <View className="flex-1">
        <Text className="font-bold text-ink">{workout.title}</Text>
        <Text className="mt-1 text-xs text-muted">{workout.category}  ·  {workout.duration_minutes} min</Text>
          {workout.exercises?.length ? (
            <View className="mt-2 gap-2">
              {workout.exercises.map((exercise) => (
                <View key={exercise.id}>
                  <Text className="text-xs font-bold text-ink">{exercise.exercise_name}</Text>
                  <Text className="mt-0.5 text-xs text-muted">
                    {exercise.sets.map((set) => `${set.weight_kg} kg × ${set.reps}`).join("  ·  ")}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
        {editingTime ? (
          <View className="mt-2 flex-row items-center gap-2">
            <TextInput
              className="rounded-xl bg-canvas px-3 py-2 text-sm text-ink"
              accessibilityLabel="Vrijeme treninga u formatu sati i minute"
              placeholder="HH:MM"
              value={time}
              onChangeText={setTime}
              maxLength={5}
            />
            <Pressable accessibilityRole="button" onPress={() => void saveTime()} disabled={saving}>
              <Text className="text-xs font-bold text-brand">{saving ? "..." : "Sačuvaj"}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => setEditingTime(false)} disabled={saving}>
              <Text className="text-xs font-semibold text-muted">Odustani</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setTime(localTimeFromTimestamp(workout.created_at));
              setEditingTime(true);
            }}
            className="mt-2 flex-row items-center gap-1"
          >
            <Clock3 size={13} color="#FF2D55" />
            <Text className="text-xs font-semibold text-brand">{formatLocalTime(workout.created_at)} · Uredi vrijeme</Text>
          </Pressable>
        )}
      </View>
      <Text className="text-sm font-bold text-brand">{workout.calories_burned} kcal</Text>
    </Card>
  );
}
