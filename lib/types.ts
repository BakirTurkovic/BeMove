export type Meal = {
  id: string;
  name: string;
  meal_name?: string;
  calories: number;
  protein_g: number;
  protein?: number;
  carbs?: number;
  fats?: number;
  weight_g?: number;
  meal_date: string;
  is_favorite: boolean;
  created_at: string;
};

export type Workout = {
  id: string;
  title: string;
  date: string;
  category: string;
  duration_minutes: number;
  calories_burned: number;
  created_at: string;
  exercises?: WorkoutExercise[];
};

export type WorkoutExercise = {
  id: string;
  exercise_name: string;
  sets: WorkoutSet[];
};

export type WorkoutSet = {
  id: string;
  set_number: number;
  weight_kg: number;
  reps: number;
};

export type WeightLog = {
  id: string;
  weight_kg: number;
  logged_at: string;
};

export type SleepLog = {
  id: string;
  hours_slept: number;
  quality: "poor" | "fair" | "good" | "excellent" | null;
  notes: string | null;
  date: string;
  created_at: string;
};

export type StepLog = {
  id: string;
  step_count: number;
  date: string;
  created_at: string;
};

export type BodyMeasurement = {
  id: string;
  date: string;
  waist_cm: number | null;
  chest_cm: number | null;
  arm_cm: number | null;
  hips_cm: number | null;
  thigh_cm: number | null;
  created_at: string;
};

export type Profile = {
  full_name: string | null;
  target_weight: number;
  calories_target: number;
  target_weight_kg: number;
  calorie_goal: number;
  starting_weight_kg: number | null;
};

export type DashboardSummary = {
  profile: Profile;
  currentWeight: number | null;
  caloriesConsumed: number;
  caloriesBurned: number;
  protein: number;
};
