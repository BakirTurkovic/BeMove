import { supabase } from "@/lib/supabase";
import type { BodyMeasurement, DashboardSummary, Meal, Profile, SleepLog, StepLog, WeightLog, Workout, WorkoutExercise, WorkoutSet } from "@/lib/types";

export const todayLocal = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export function localTimeFromTimestamp(timestamp: string) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) throw new Error("Vrijeme zapisa nije validno.");
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export function localDateTimeToIso(date: string, time: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)) {
    throw new Error("Unesi datum u formatu YYYY-MM-DD i vrijeme u formatu HH:MM.");
  }
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const localDate = new Date(year, month - 1, day, hour, minute, 0, 0);
  if (
    localDate.getFullYear() !== year ||
    localDate.getMonth() !== month - 1 ||
    localDate.getDate() !== day
  ) {
    throw new Error("Unesi validan datum.");
  }
  return localDate.toISOString();
}

export function formatLocalTime(timestamp: string) {
  return new Intl.DateTimeFormat("bs-BA", { hour: "2-digit", minute: "2-digit" })
    .format(new Date(timestamp));
}

export async function getProfile(userId: string): Promise<Profile> {
  const { data, error } = await supabase
    .from("profiles")
    .select("full_name, target_weight, calories_target, target_weight_kg, calorie_goal, starting_weight_kg")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  if (data) {
    return {
      ...data,
      target_weight: data.target_weight ?? data.target_weight_kg ?? 115,
      calories_target: data.calories_target ?? data.calorie_goal ?? 2200
    };
  }

  const { data: created, error: createError } = await supabase
    .from("profiles")
    .upsert({
      id: userId,
      target_weight: 115,
      target_weight_kg: 115,
      calories_target: 2200,
      calorie_goal: 2200
    }, { onConflict: "id" })
    .select("full_name, target_weight, calories_target, target_weight_kg, calorie_goal, starting_weight_kg")
    .single();
  if (createError) throw createError;
  return {
    ...created,
    target_weight: created.target_weight ?? created.target_weight_kg ?? 115,
    calories_target: created.calories_target ?? created.calorie_goal ?? 2200
  };
}

export async function saveProfile(
  userId: string,
  values: Partial<Profile> & { full_name?: string | null }
) {
  const row: Record<string, string | number | null> = { id: userId };
  if (values.full_name !== undefined) row.full_name = values.full_name;
  if (values.target_weight !== undefined || values.target_weight_kg !== undefined) {
    const target = values.target_weight ?? values.target_weight_kg;
    if (target !== undefined) {
      row.target_weight = target;
      row.target_weight_kg = target;
    }
  }
  if (values.calories_target !== undefined || values.calorie_goal !== undefined) {
    const goal = values.calories_target ?? values.calorie_goal;
    if (goal !== undefined) {
      row.calories_target = goal;
      row.calorie_goal = goal;
    }
  }
  if (values.starting_weight_kg !== undefined) row.starting_weight_kg = values.starting_weight_kg;

  const { error } = await supabase.from("profiles").upsert(row);
  if (error) throw error;
}

export async function getDashboardSummary(userId: string): Promise<DashboardSummary> {
  const date = todayLocal();
  const [profile, mealsResult, workoutsResult, weightsResult] = await Promise.all([
    getProfile(userId),
    supabase
      .from("meals")
      .select("calories, protein_g")
      .eq("user_id", userId)
      .eq("meal_date", date),
    supabase
      .from("workouts")
      .select("calories_burned")
      .eq("user_id", userId)
      .eq("date", date),
    supabase
      .from("weight_logs")
      .select("weight_kg")
      .eq("user_id", userId)
      .order("logged_at", { ascending: false })
      .limit(1)
  ]);
  if (mealsResult.error) throw mealsResult.error;
  if (workoutsResult.error) throw workoutsResult.error;
  if (weightsResult.error) throw weightsResult.error;

  return {
    profile,
    currentWeight: weightsResult.data[0]?.weight_kg ?? profile.starting_weight_kg,
    caloriesConsumed: mealsResult.data.reduce((sum, meal) => sum + meal.calories, 0),
    caloriesBurned: workoutsResult.data.reduce((sum, workout) => sum + workout.calories_burned, 0),
    protein: mealsResult.data.reduce((sum, meal) => sum + meal.protein_g, 0)
  };
}

export async function listMeals(userId: string): Promise<Meal[]> {
  const { data, error } = await supabase
    .from("meals")
    .select("id, name, meal_name, calories, protein_g, protein, carbs, fats, weight_g, meal_date, is_favorite, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return data;
}

export async function createMeal(
  userId: string,
  meal: Omit<Meal, "id" | "is_favorite" | "created_at"> & { created_at?: string }
) {
  const { error } = await supabase.from("meals").insert({
    ...meal,
    meal_name: meal.meal_name ?? meal.name,
    protein: meal.protein ?? meal.protein_g,
    carbs: meal.carbs ?? 0,
    fats: meal.fats ?? 0,
    weight_g: meal.weight_g ?? 0,
    user_id: userId
  });
  if (error) throw error;
}

export async function updateMealTime(id: string, createdAt: string) {
  const { error } = await supabase.from("meals").update({ created_at: createdAt }).eq("id", id);
  if (error) throw error;
}

export async function setMealFavorite(id: string, isFavorite: boolean) {
  const { error } = await supabase.from("meals").update({ is_favorite: isFavorite }).eq("id", id);
  if (error) throw error;
}

export async function listWorkouts(userId: string): Promise<Workout[]> {
  const { data, error } = await supabase
    .from("workouts")
    .select("id, title, date, category, duration_minutes, calories_burned, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  if (!data.length) return [];

  const workoutIds = data.map((workout) => workout.id);
  const { data: exerciseRows, error: exercisesError } = await supabase
    .from("workout_exercises")
    .select("id, workout_id, exercise_name")
    .in("workout_id", workoutIds);
  if (exercisesError) throw exercisesError;

  const exerciseIds = (exerciseRows ?? []).map((exercise) => exercise.id);
  let setRows: (WorkoutSet & { workout_exercise_id: string })[] = [];
  if (exerciseIds.length) {
    const { data: sets, error: setsError } = await supabase
      .from("workout_sets")
      .select("id, workout_exercise_id, set_number, weight_kg, reps")
      .in("workout_exercise_id", exerciseIds)
      .order("set_number", { ascending: true });
    if (setsError) throw setsError;
    setRows = sets ?? [];
  }

  const setsByExercise = new Map<string, WorkoutSet[]>();
  for (const set of setRows) {
    const exerciseSets = setsByExercise.get(set.workout_exercise_id) ?? [];
    exerciseSets.push({
      id: set.id,
      set_number: set.set_number,
      weight_kg: Number(set.weight_kg),
      reps: set.reps
    });
    setsByExercise.set(set.workout_exercise_id, exerciseSets);
  }

  const exercisesByWorkout = new Map<string, WorkoutExercise[]>();
  for (const exercise of exerciseRows ?? []) {
    const workoutExercises = exercisesByWorkout.get(exercise.workout_id) ?? [];
    workoutExercises.push({
      id: exercise.id,
      exercise_name: exercise.exercise_name,
      sets: setsByExercise.get(exercise.id) ?? []
    });
    exercisesByWorkout.set(exercise.workout_id, workoutExercises);
  }

  return data.map((workout) => ({
    ...workout,
    exercises: exercisesByWorkout.get(workout.id) ?? []
  }));
}

export async function createWorkout(
  userId: string,
  workout: Omit<Workout, "id" | "created_at" | "exercises"> & { created_at?: string }
): Promise<string> {
  const { data, error } = await supabase.from("workouts").insert({
    ...workout,
    user_id: userId,
    // Keep legacy columns populated while existing installations are migrated.
    name: workout.title,
    workout_date: workout.date
  }).select("id").single();
  if (error) throw error;
  return data.id;
}

export async function createWorkoutExercises(
  workoutId: string,
  exercises: { exercise_name: string; sets: { set_number: number; weight_kg: number; reps: number }[] }[]
) {
  for (const exercise of exercises) {
    const { data, error } = await supabase
      .from("workout_exercises")
      .insert({ workout_id: workoutId, exercise_name: exercise.exercise_name })
      .select("id")
      .single();
    if (error) throw error;
    if (!exercise.sets.length) continue;
    const { error: setsError } = await supabase.from("workout_sets").insert(
      exercise.sets.map((set) => ({
        workout_exercise_id: data.id,
        set_number: set.set_number,
        weight_kg: set.weight_kg,
        reps: set.reps
      }))
    );
    if (setsError) throw setsError;
  }
}

export async function updateWorkoutTime(id: string, createdAt: string) {
  const { error } = await supabase.from("workouts").update({ created_at: createdAt }).eq("id", id);
  if (error) throw error;
}

export async function listWeightLogs(userId: string): Promise<WeightLog[]> {
  const { data, error } = await supabase
    .from("weight_logs")
    .select("id, weight_kg, logged_at")
    .eq("user_id", userId)
    .order("logged_at", { ascending: true })
    .limit(90);
  if (error) throw error;
  return data;
}

export async function createWeightLog(userId: string, weightKg: number) {
  const { error } = await supabase
    .from("weight_logs")
    .insert({ user_id: userId, weight_kg: weightKg, logged_at: new Date().toISOString() });
  if (error) throw error;
}

export async function listSleepLogs(userId: string): Promise<SleepLog[]> {
  const { data, error } = await supabase
    .from("sleep_logs")
    .select("id, hours_slept, quality, notes, date, created_at")
    .eq("user_id", userId)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(90);
  if (error) throw error;
  return data ?? [];
}

export async function createSleepLog(
  userId: string,
  entry: Pick<SleepLog, "hours_slept" | "quality" | "notes" | "date">
) {
  const { error } = await supabase.from("sleep_logs").insert({ ...entry, user_id: userId });
  if (error) throw error;
}

export async function getStepLog(userId: string, date: string): Promise<StepLog | null> {
  const { data, error } = await supabase
    .from("step_logs")
    .select("id, step_count, date, created_at")
    .eq("user_id", userId)
    .eq("date", date)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function syncSteps(userId: string, stepCount: number, date = todayLocal()): Promise<StepLog> {
  if (!Number.isSafeInteger(stepCount) || stepCount < 0) {
    throw new Error("Broj koraka mora biti cijeli broj veći ili jednak nuli.");
  }
  const { data, error } = await supabase
    .from("step_logs")
    .upsert(
      { user_id: userId, step_count: stepCount, date },
      { onConflict: "user_id,date" }
    )
    .select("id, step_count, date, created_at")
    .single();
  if (error) throw error;
  return data;
}

export async function listBodyMeasurements(userId: string): Promise<BodyMeasurement[]> {
  const { data, error } = await supabase
    .from("body_measurements")
    .select("id, date, waist_cm, chest_cm, arm_cm, hips_cm, thigh_cm, created_at")
    .eq("user_id", userId)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return data ?? [];
}

export async function createBodyMeasurement(
  userId: string,
  measurement: Omit<BodyMeasurement, "id" | "created_at">
) {
  const { error } = await supabase
    .from("body_measurements")
    .insert({ ...measurement, user_id: userId });
  if (error) throw error;
}

export type CalendarDayData = {
  markedDates: Set<string>;
  dailyScores: Record<string, DailyGoalScore>;
  calorieTarget: number;
  meals: Meal[];
  workouts: Workout[];
  weight: number | null;
  sleepLogs: SleepLog[];
  stepCount: number | null;
  bodyMeasurements: BodyMeasurement[];
};

export type DailyGoalScore = {
  calories: number;
  hasWorkout: boolean;
  sleepHours: number;
  completedGoals: number;
  exceededCalories: boolean;
  hasData: boolean;
};

export async function getCalendarDayData(
  userId: string,
  selectedDate: string,
  monthStart: string,
  monthEnd: string
): Promise<CalendarDayData> {
  const [profile, monthMeals, monthWorkouts, monthWeights, monthSleep, monthSteps, monthMeasurements, mealsResult, workoutsResult, weightResult, sleepResult, stepsResult, measurementsResult] = await Promise.all([
    getProfile(userId),
    supabase.from("meals").select("meal_date, calories").eq("user_id", userId).gte("meal_date", monthStart).lte("meal_date", monthEnd),
    supabase.from("workouts").select("date").eq("user_id", userId).gte("date", monthStart).lte("date", monthEnd),
    supabase.from("weight_logs").select("date").eq("user_id", userId).gte("date", monthStart).lte("date", monthEnd),
    supabase.from("sleep_logs").select("date, hours_slept").eq("user_id", userId).gte("date", monthStart).lte("date", monthEnd),
    supabase.from("step_logs").select("date").eq("user_id", userId).gte("date", monthStart).lte("date", monthEnd),
    supabase.from("body_measurements").select("date").eq("user_id", userId).gte("date", monthStart).lte("date", monthEnd),
    supabase
      .from("meals")
      .select("id, name, meal_name, calories, protein_g, protein, carbs, fats, weight_g, meal_date, is_favorite, created_at")
      .eq("user_id", userId)
      .eq("meal_date", selectedDate)
      .order("created_at", { ascending: false }),
    supabase
      .from("workouts")
      .select("id, title, date, category, duration_minutes, calories_burned, created_at")
      .eq("user_id", userId)
      .eq("date", selectedDate)
      .order("created_at", { ascending: false }),
    supabase
      .from("weight_logs")
      .select("weight_kg")
      .eq("user_id", userId)
      .eq("date", selectedDate)
      .order("logged_at", { ascending: false })
      .limit(1),
    supabase
      .from("sleep_logs")
      .select("id, hours_slept, quality, notes, date, created_at")
      .eq("user_id", userId)
      .eq("date", selectedDate)
      .order("created_at", { ascending: false }),
    supabase
      .from("step_logs")
      .select("step_count")
      .eq("user_id", userId)
      .eq("date", selectedDate)
      .maybeSingle(),
    supabase
      .from("body_measurements")
      .select("id, date, waist_cm, chest_cm, arm_cm, hips_cm, thigh_cm, created_at")
      .eq("user_id", userId)
      .eq("date", selectedDate)
      .order("created_at", { ascending: false })
  ]);

  for (const result of [monthMeals, monthWorkouts, monthWeights, monthSleep, monthSteps, monthMeasurements, mealsResult, workoutsResult, weightResult, sleepResult, stepsResult, measurementsResult]) {
    if (result.error) throw result.error;
  }

  const calorieTarget = Number(profile.calories_target);
  const dailyScores: Record<string, DailyGoalScore> = {};
  const [startYear, startMonth, startDay] = monthStart.split("-").map(Number);
  const [endYear, endMonth, endDay] = monthEnd.split("-").map(Number);
  const dayCursor = new Date(startYear, startMonth - 1, startDay);
  const finalDay = new Date(endYear, endMonth - 1, endDay);
  while (dayCursor <= finalDay) {
    const date = todayLocalFromDate(dayCursor);
    dailyScores[date] = {
      calories: 0,
      hasWorkout: false,
      sleepHours: 0,
      completedGoals: 0,
      exceededCalories: false,
      hasData: false
    };
    dayCursor.setDate(dayCursor.getDate() + 1);
  }

  (monthMeals.data ?? []).forEach((row) => {
    const score = dailyScores[row.meal_date];
    if (score) {
      score.calories += Number(row.calories) || 0;
      score.hasData = true;
    }
  });
  (monthWorkouts.data ?? []).forEach((row) => {
    const score = dailyScores[row.date];
    if (score) {
      score.hasWorkout = true;
      score.hasData = true;
    }
  });
  (monthSleep.data ?? []).forEach((row) => {
    const score = dailyScores[row.date];
    if (score) {
      score.sleepHours += Number(row.hours_slept) || 0;
      score.hasData = true;
    }
  });

  for (const [date, score] of Object.entries(dailyScores)) {
    score.exceededCalories = score.calories > calorieTarget;
    score.completedGoals =
      Number(!score.exceededCalories) +
      Number(score.hasWorkout) +
      Number(score.sleepHours >= 7);
    if (date > todayLocal()) {
      delete dailyScores[date];
    }
  }

  const markedDates = new Set<string>();
  (monthMeals.data ?? []).forEach((row) => markedDates.add(row.meal_date));
  (monthWorkouts.data ?? []).forEach((row) => markedDates.add(row.date));
  (monthWeights.data ?? []).forEach((row) => markedDates.add(row.date));
  (monthSleep.data ?? []).forEach((row) => markedDates.add(row.date));
  (monthSteps.data ?? []).forEach((row) => markedDates.add(row.date));
  (monthMeasurements.data ?? []).forEach((row) => markedDates.add(row.date));

  return {
    markedDates,
    dailyScores,
    calorieTarget,
    meals: mealsResult.data ?? [],
    workouts: workoutsResult.data ?? [],
    weight: weightResult.data?.[0]?.weight_kg ?? null,
    sleepLogs: sleepResult.data ?? [],
    stepCount: stepsResult.data?.step_count ?? null,
    bodyMeasurements: measurementsResult.data ?? []
  };
}

function todayLocalFromDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getDataErrorMessage(error: unknown): string {
  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;
    if (record.code === "PGRST205" || record.code === "PGRST204" || record.status === 404) {
      return "Nedostaje tabela ili kolona u Supabase bazi. Pokreni supabase/schema.sql u Supabase SQL Editoru, pa pokušaj ponovo.";
    }
    if (typeof record.message === "string") return record.message;
  }
  return "Došlo je do neočekivane greške. Pokušaj ponovo.";
}
