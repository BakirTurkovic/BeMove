import { useCallback, useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { ChevronLeft, ChevronRight, Dumbbell, Flame, Footprints, Moon, Ruler, Salad, Scale } from "lucide-react-native";
import {
  AppScreen,
  Card,
  DataErrorState,
  Header,
  LoadingState,
  Metric,
  SectionTitle
} from "@/components/ui";
import { getCalendarDayData, getDataErrorMessage, todayLocal } from "@/lib/data";
import { supabase } from "@/lib/supabase";
import type { CalendarDayData } from "@/lib/data";

const weekdays = ["P", "U", "S", "Č", "P", "S", "N"];
const monthNames = [
  "Januar", "Februar", "Mart", "April", "Maj", "Juni",
  "Juli", "August", "Septembar", "Oktobar", "Novembar", "Decembar"
];
const weekdayNames = [
  "Nedjelja", "Ponedjeljak", "Utorak", "Srijeda",
  "Četvrtak", "Petak", "Subota"
];

function formatLocalDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getCalendarDates(month: Date) {
  const firstWeekday = (new Date(month.getFullYear(), month.getMonth(), 1).getDay() + 6) % 7;
  const firstDate = new Date(month.getFullYear(), month.getMonth(), 1 - firstWeekday);
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(firstDate);
    date.setDate(firstDate.getDate() + index);
    return date;
  });
}

function formatSelectedDate(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  const selected = new Date(year, month - 1, day);
  return `${weekdayNames[selected.getDay()]}, ${day}. ${monthNames[month - 1]} ${year}.`;
}

function formatMonthTitle(date: Date) {
  return `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
}

export default function CalendarScreen() {
  const [selectedDate, setSelectedDate] = useState(todayLocal());
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [dayData, setDayData] = useState<CalendarDayData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const dates = useMemo(() => getCalendarDates(visibleMonth), [visibleMonth]);
  const bounds = useMemo(() => ({
    start: formatLocalDate(dates[0]),
    end: formatLocalDate(dates[dates.length - 1])
  }), [dates]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!data.user) throw new Error("Sesija je istekla. Prijavi se ponovo.");
      setDayData(await getCalendarDayData(data.user.id, selectedDate, bounds.start, bounds.end));
    } catch (loadError) {
      setError(getDataErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [bounds.end, bounds.start, selectedDate]);

  useFocusEffect(useCallback(() => {
    void load();
  }, [load]));

  function changeMonth(delta: number) {
    setVisibleMonth((month) => new Date(month.getFullYear(), month.getMonth() + delta, 1));
  }

  function selectDate(date: Date) {
    const selected = formatLocalDate(date);
    setSelectedDate(selected);
    if (date.getMonth() !== visibleMonth.getMonth() || date.getFullYear() !== visibleMonth.getFullYear()) {
      setVisibleMonth(new Date(date.getFullYear(), date.getMonth(), 1));
    }
  }

  if (loading && !dayData) return <AppScreen><LoadingState /></AppScreen>;
  if (error && !dayData) return <AppScreen><DataErrorState message={error} onRetry={() => void load()} /></AppScreen>;

  const meals = dayData?.meals ?? [];
  const workouts = dayData?.workouts ?? [];
  const calories = meals.reduce((total, meal) => total + meal.calories, 0);
  const protein = meals.reduce((total, meal) => total + (meal.protein ?? meal.protein_g ?? 0), 0);
  const carbs = meals.reduce((total, meal) => total + (meal.carbs ?? 0), 0);
  const fats = meals.reduce((total, meal) => total + (meal.fats ?? 0), 0);
  const duration = workouts.reduce((total, workout) => total + workout.duration_minutes, 0);
  const selectedWeight = dayData?.weight;
  const sleepHours = (dayData?.sleepLogs ?? []).reduce((total, log) => total + Number(log.hours_slept), 0);
  const monthTitle = formatMonthTitle(visibleMonth);
  const selectedScore = dayData?.dailyScores[selectedDate];
  const scoreColor = (completedGoals: number, exceededCalories: boolean) => {
    if (exceededCalories || completedGoals === 0) return "#EF4444";
    if (completedGoals === 1) return "#FBBF24";
    if (completedGoals === 2) return "#84CC16";
    return "#10B981";
  };
  const scoreLabel = (completedGoals: number, exceededCalories: boolean) => {
    if (exceededCalories) return "Iznad kalorijskog cilja";
    if (completedGoals === 3) return "Potpuni uspjeh";
    if (completedGoals === 2) return "Dobar dan";
    if (completedGoals === 1) return "Djelomičan uspjeh";
    return "Bez ispunjenih ciljeva";
  };

  return (
    <AppScreen>
      <Header title="Kalendar" subtitle="TVOJ NAPREDAK, DAN PO DAN" />
      <Card className="p-4">
        <View className="mb-5 flex-row items-center justify-between">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Prethodni mjesec"
            onPress={() => changeMonth(-1)}
            className="rounded-xl bg-canvas p-2"
          >
            <ChevronLeft size={21} color="#1C1C1E" />
          </Pressable>
          <Text className="text-base font-extrabold capitalize text-ink">{monthTitle}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Sljedeći mjesec"
            onPress={() => changeMonth(1)}
            className="rounded-xl bg-canvas p-2"
          >
            <ChevronRight size={21} color="#1C1C1E" />
          </Pressable>
        </View>
        <View className="mb-2 flex-row">
          {weekdays.map((weekday, index) => (
            <Text key={`${weekday}-${index}`} className="flex-1 py-2 text-center text-xs font-bold text-muted">
              {weekday}
            </Text>
          ))}
        </View>
        <View className="flex-row flex-wrap">
          {dates.map((date) => {
            const dateString = formatLocalDate(date);
            const isSelected = dateString === selectedDate;
            const isCurrentMonth = date.getMonth() === visibleMonth.getMonth();
            const isToday = dateString === todayLocal();
            const dayScore = dayData?.dailyScores[dateString];
            const hasScoreData = dayScore?.hasData ?? false;
            const circleColor = dayScore && hasScoreData
              ? scoreColor(dayScore.completedGoals, dayScore.exceededCalories)
              : dateString <= todayLocal() ? "#F3F4F6" : "transparent";
            const circleTextColor = hasScoreData
              ? "#FFFFFF"
              : isSelected ? "#1C1C1E" : isCurrentMonth ? "#1C1C1E" : "#C7C7CC";
            const scoreAccessibility = dayScore
              ? dayScore.hasData
                ? `, ${dayScore.completedGoals} od 3 cilja${dayScore.exceededCalories ? ", kalorijski cilj prekoračen" : ""}`
                : ", nema unosa za ciljeve"
              : "";
            return (
              <Pressable
                key={dateString}
                accessibilityRole="button"
                accessibilityLabel={`${dateString}${scoreAccessibility}`}
                accessibilityState={{ selected: isSelected }}
                onPress={() => selectDate(date)}
                className="h-11 w-[14.2857%] items-center justify-center"
              >
                <View
                  className="h-9 w-9 items-center justify-center rounded-full"
                  style={{
                    backgroundColor: circleColor,
                    borderWidth: isSelected ? 2 : isToday ? 1 : 0,
                    borderColor: isSelected ? "#1C1C1E" : isToday ? "#FF2D55" : "transparent"
                  }}
                >
                  <Text
                    className="text-sm font-semibold"
                    style={{ color: isToday && !isSelected && !hasScoreData ? "#FF2D55" : circleTextColor }}
                  >
                    {date.getDate()}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
        <View className="mt-3 flex-row flex-wrap justify-center gap-x-3 gap-y-2">
          {[
            { color: "#10B981", label: "3/3" },
            { color: "#84CC16", label: "2/3" },
            { color: "#FBBF24", label: "1/3" },
            { color: "#EF4444", label: "0/3 ili prekoračenje" }
          ].map(({ color, label }) => (
            <View key={label} className="flex-row items-center gap-1">
              <View className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
              <Text className="text-[10px] text-muted">{label}</Text>
            </View>
          ))}
        </View>
      </Card>

      {error ? (
        <View className="mt-4">
          <DataErrorState message={error} onRetry={() => void load()} />
        </View>
      ) : (
        <>
          <SectionTitle title={formatSelectedDate(selectedDate)} />
          {loading ? (
            <Card className="items-center py-5">
              <LoadingState />
            </Card>
          ) : (
            <>
              <Card className="bg-brand">
                <Text className="text-sm font-semibold text-white/80">Dnevni pregled</Text>
                <View className="mt-4 flex-row">
                  <Metric label="Kalorije" value={calories} unit="kcal" />
                  <Metric label="Proteini" value={Math.round(protein)} unit="g" />
                </View>
                <View className="my-4 h-px bg-white/25" />
                <View className="flex-row">
                  <Metric label="Ugljikohidrati" value={Math.round(carbs)} unit="g" />
                  <Metric label="Masti" value={Math.round(fats)} unit="g" />
                </View>
                <View className="my-4 h-px bg-white/25" />
                <View className="flex-row">
                  <Metric label="Treninzi" value={workouts.length} />
                  <Metric label="Trajanje" value={duration} unit="min" />
                  <Metric label="Težina" value={selectedWeight?.toFixed(1) ?? "—"} unit={selectedWeight ? "kg" : undefined} />
                </View>
                {(dayData?.sleepLogs.length ?? 0) > 0 ? (
                  <>
                    <View className="my-4 h-px bg-white/25" />
                    <Metric label="San" value={sleepHours.toFixed(1)} unit="h" />
                  </>
                ) : null}
                {typeof dayData?.stepCount === "number" ? (
                  <>
                    <View className="my-4 h-px bg-white/25" />
                    <Metric label="Koraci" value={dayData.stepCount.toLocaleString()} />
                  </>
                ) : null}
              </Card>

              <SectionTitle title="Ocjena dana" />
              <Card>
                {selectedScore?.hasData ? (
                  <>
                    <View className="mb-4 flex-row items-center">
                      <View
                        className="mr-3 h-10 w-10 items-center justify-center rounded-full"
                        style={{ backgroundColor: "#F8F9FA" }}
                      >
                        <View
                          className="h-4 w-4 rounded-full"
                          style={{ backgroundColor: scoreColor(selectedScore.completedGoals, selectedScore.exceededCalories) }}
                        />
                      </View>
                      <View>
                        <Text className="font-bold text-ink">
                          {selectedScore.completedGoals}/3 cilja · {scoreLabel(selectedScore.completedGoals, selectedScore.exceededCalories)}
                        </Text>
                        <Text className="mt-1 text-xs text-muted">
                          {selectedScore.exceededCalories
                            ? `Kalorijski unos prelazi cilj od ${dayData?.calorieTarget.toLocaleString()} kcal.`
                            : `${selectedScore.completedGoals} od 3 dnevna cilja je ispunjeno.`}
                        </Text>
                      </View>
                    </View>
                    <View className="gap-2">
                      <Text className="text-sm text-ink">
                        🏋️ Trening: {selectedScore.hasWorkout ? "Odrađen" : "Propušten"}
                      </Text>
                      <Text className="text-sm text-ink">
                        🥗 Kalorije: {selectedScore.exceededCalories ? "Prekoračeno" : "U okviru cilja"}
                        {" "}({selectedScore.calories.toLocaleString()} / {dayData?.calorieTarget.toLocaleString()} kcal)
                      </Text>
                      <Text className="text-sm text-ink">
                        😴 San: {selectedScore.sleepHours >= 7 ? "Dovoljno" : "Nedovoljno"}
                        {" "}({selectedScore.sleepHours.toFixed(1)} / 7 h)
                      </Text>
                    </View>
                  </>
                ) : (
                  <Text className="text-sm leading-5 text-muted">
                    Nema unosa obroka, treninga ili sna za ocjenu ovog dana.
                  </Text>
                )}
              </Card>

              <SectionTitle title="Obroci" action={`${meals.length}`} />
              {meals.length === 0 ? (
                <Card><Text className="text-sm text-muted">Za ovaj dan nema evidentiranih obroka.</Text></Card>
              ) : meals.map((meal) => (
                <Card key={meal.id} className="mb-3 flex-row items-center">
                  <View className="mr-3 h-10 w-10 items-center justify-center rounded-2xl bg-blush">
                    <Salad size={19} color="#FF2D55" />
                  </View>
                  <View className="flex-1">
                    <Text className="font-bold text-ink">{meal.meal_name ?? meal.name}</Text>
                    <Text className="mt-1 text-xs text-muted">
                      P {meal.protein ?? meal.protein_g ?? 0} g · UH {meal.carbs ?? 0} g · M {meal.fats ?? 0} g
                    </Text>
                  </View>
                  <Text className="text-sm font-bold text-brand">{meal.calories} kcal</Text>
                </Card>
              ))}

              <SectionTitle title="Treninzi" action={`${workouts.length}`} />
              {workouts.length === 0 ? (
                <Card><Text className="text-sm text-muted">Za ovaj dan nema evidentiranih treninga.</Text></Card>
              ) : workouts.map((workout) => (
                <Card key={workout.id} className="mb-3 flex-row items-center">
                  <View className="mr-3 h-10 w-10 items-center justify-center rounded-2xl bg-blush">
                    <Dumbbell size={19} color="#FF2D55" />
                  </View>
                  <View className="flex-1">
                    <Text className="font-bold text-ink">{workout.title}</Text>
                    <Text className="mt-1 text-xs text-muted">
                      {workout.category} · {workout.duration_minutes} min · Odrađeno
                    </Text>
                  </View>
                  <Flame size={17} color="#FF2D55" />
                  <Text className="ml-1 text-xs font-bold text-brand">{workout.calories_burned}</Text>
                </Card>
              ))}

              <SectionTitle title="Tjelesna težina" />
              <Card className="flex-row items-center">
                <View className="mr-3 h-10 w-10 items-center justify-center rounded-2xl bg-blush">
                  <Scale size={19} color="#FF2D55" />
                </View>
                <View className="flex-1">
                  <Text className="font-bold text-ink">Mjerenje za odabrani dan</Text>
                  <Text className="mt-1 text-xs text-muted">
                    {selectedWeight === null ? "Nema unosa težine za ovaj dan." : "Posljednje mjerenje tog dana"}
                  </Text>
                </View>
                {typeof selectedWeight === "number"
                  ? <Text className="text-base font-extrabold text-brand">{selectedWeight.toFixed(1)} kg</Text>
                  : null}
              </Card>

              <SectionTitle title="Obimi tijela" action={`${dayData?.bodyMeasurements.length ?? 0}`} />
              {(dayData?.bodyMeasurements.length ?? 0) === 0 ? (
                <Card><Text className="text-sm text-muted">Za ovaj dan nema unesenih obima tijela.</Text></Card>
              ) : dayData?.bodyMeasurements.map((entry) => (
                <Card key={entry.id} className="mb-3">
                  <View className="mb-3 flex-row items-center">
                    <View className="mr-3 h-10 w-10 items-center justify-center rounded-2xl bg-blush">
                      <Ruler size={19} color="#FF2D55" />
                    </View>
                    <Text className="font-bold text-ink">Mjerenje obima</Text>
                  </View>
                  <View className="flex-row flex-wrap gap-y-3">
                    {([
                      ["Struk", entry.waist_cm],
                      ["Ruka", entry.arm_cm],
                      ["Prsa", entry.chest_cm],
                      ["Kukovi", entry.hips_cm],
                      ["Noga", entry.thigh_cm]
                    ] as const).filter(([, value]) => value !== null).map(([label, value]) => (
                      <View key={label} className="w-1/2">
                        <Text className="text-xs text-muted">{label}</Text>
                        <Text className="mt-1 font-bold text-ink">{Number(value).toFixed(1)} cm</Text>
                      </View>
                    ))}
                  </View>
                </Card>
              ))}

              <SectionTitle title="San" />
              {(dayData?.sleepLogs.length ?? 0) === 0 ? (
                <Card><Text className="text-sm text-muted">Za ovaj dan nema evidentiranog sna.</Text></Card>
              ) : dayData?.sleepLogs.map((log) => (
                <Card key={log.id} className="mb-3 flex-row items-center">
                  <View className="mr-3 h-10 w-10 items-center justify-center rounded-2xl bg-blush">
                    <Moon size={19} color="#FF2D55" />
                  </View>
                  <View className="flex-1">
                    <Text className="font-bold text-ink">{Number(log.hours_slept).toFixed(1)} sata sna</Text>
                    <Text className="mt-1 text-xs text-muted">{log.quality ?? "Kvalitet nije naveden"}</Text>
                  </View>
                  {log.notes ? <Text className="max-w-[45%] text-right text-xs text-muted">{log.notes}</Text> : null}
                </Card>
              ))}

              <SectionTitle title="Koraci" />
              <Card className="flex-row items-center">
                <View className="mr-3 h-10 w-10 items-center justify-center rounded-2xl bg-blush">
                  <Footprints size={19} color="#FF2D55" />
                </View>
                <View className="flex-1">
                  <Text className="font-bold text-ink">Koraci za odabrani dan</Text>
                  <Text className="mt-1 text-xs text-muted">
                    {dayData?.stepCount === null ? "Nema unosa koraka za ovaj dan." : "Dnevni broj koraka"}
                  </Text>
                </View>
                {typeof dayData?.stepCount === "number"
                  ? <Text className="text-base font-extrabold text-brand">{dayData.stepCount.toLocaleString()}</Text>
                  : null}
              </Card>
            </>
          )}
        </>
      )}
    </AppScreen>
  );
}
