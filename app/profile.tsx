import { useCallback, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { LogOut, UserRound } from "lucide-react-native";
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
import { createWeightLog, getDataErrorMessage, getProfile, listWeightLogs, saveProfile } from "@/lib/data";
import { supabase } from "@/lib/supabase";
import type { Profile as ProfileData, WeightLog } from "@/lib/types";

export default function ProfileScreen() {
  const [latestWeight, setLatestWeight] = useState<WeightLog | null>(null);
  const [fullName, setFullName] = useState("");
  const [targetWeight, setTargetWeight] = useState("");
  const [caloriesTarget, setCaloriesTarget] = useState("");
  const [currentWeight, setCurrentWeight] = useState("");
  const [isGuest, setIsGuest] = useState(false);
  const [accountEmail, setAccountEmail] = useState("");
  const [accountPassword, setAccountPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formMessage, setFormMessage] = useState<{ kind: "error" | "success"; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!authData.user) throw new Error("Sesija je istekla. Prijavi se ponovo.");
      setIsGuest(Boolean(authData.user.is_anonymous));

      const [profileData, weightLogs] = await Promise.all([
        getProfile(authData.user.id),
        listWeightLogs(authData.user.id)
      ]);
      const latest = weightLogs.at(-1) ?? null;

      setLatestWeight(latest);
      setFullName(profileData.full_name ?? "");
      setTargetWeight(String(profileData.target_weight));
      setCaloriesTarget(String(profileData.calories_target));
    } catch (loadError) {
      setError(getDataErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    void load();
  }, [load]));

  async function saveChanges() {
    const target = Number(targetWeight);
    const calorieGoal = Number(caloriesTarget);
    const weight = currentWeight.trim() ? Number(currentWeight) : null;

    if (!Number.isFinite(target) || target < 25 || target > 400) {
      setFormMessage({ kind: "error", text: "Ciljana težina mora biti između 25 i 400 kg." });
      return;
    }
    if (!Number.isInteger(calorieGoal) || calorieGoal < 500 || calorieGoal > 10000) {
      setFormMessage({ kind: "error", text: "Dnevni cilj kalorija mora biti cijeli broj između 500 i 10.000 kcal." });
      return;
    }
    if (weight !== null && (!Number.isFinite(weight) || weight < 25 || weight > 400)) {
      setFormMessage({ kind: "error", text: "Trenutna težina mora biti između 25 i 400 kg." });
      return;
    }

    setSaving(true);
    setFormMessage(null);
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!authData.user) throw new Error("Sesija je istekla. Prijavi se ponovo.");

      await saveProfile(authData.user.id, {
        full_name: fullName.trim() || null,
        target_weight: target,
        target_weight_kg: target,
        calories_target: calorieGoal,
        calorie_goal: calorieGoal
      });

      if (weight !== null) {
        await createWeightLog(authData.user.id, weight);
        setCurrentWeight("");
      }

      if (weight !== null) {
        setLatestWeight({
          id: `local-${Date.now()}`,
          weight_kg: weight,
          logged_at: new Date().toISOString()
        });
      }
      setFormMessage({ kind: "success", text: "Promjene profila su sačuvane." });
    } catch (saveError) {
      setFormMessage({
        kind: "error",
        text: `Promjene nisu sačuvane: ${getDataErrorMessage(saveError)}`
      });
    } finally {
      setSaving(false);
    }
  }

  async function signOut() {
    setFormMessage(null);
    try {
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) throw signOutError;
    } catch (signOutError) {
      setFormMessage({ kind: "error", text: `Odjava nije uspjela: ${getDataErrorMessage(signOutError)}` });
    }
  }

  async function linkGuestAccount() {
    const email = accountEmail.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || accountPassword.length < 6) {
      setFormMessage({ kind: "error", text: "Unesi ispravnu email adresu i lozinku od najmanje 6 znakova." });
      return;
    }

    setSaving(true);
    setFormMessage(null);
    try {
      const { data, error: updateError } = await supabase.auth.updateUser({ email, password: accountPassword });
      if (updateError) throw updateError;
      setIsGuest(Boolean(data.user.is_anonymous));
      setAccountPassword("");
      setFormMessage({
        kind: "success",
        text: data.user.is_anonymous
          ? "Provjeri email i potvrdi adresu. Ostani prijavljen/a na ovom uređaju dok se povezivanje ne dovrši."
          : "Email je povezan s profilom. Tvoji postojeći podaci ostaju sačuvani."
      });
    } catch (linkError) {
      setFormMessage({ kind: "error", text: `Nalog nije povezan: ${getDataErrorMessage(linkError)}` });
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <AppScreen><LoadingState /></AppScreen>;
  if (error) return <AppScreen><DataErrorState message={error} onRetry={() => void load()} /></AppScreen>;

  return (
    <AppScreen>
      <Header
        title="Moj profil"
        subtitle="TVOJ NAPREDAK, TVOJA PRAVILA"
        right={(
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Odjavi se"
            onPress={() => void signOut()}
            className="rounded-2xl bg-white p-3"
          >
            <LogOut size={19} color="#FF2D55" />
          </Pressable>
        )}
      />

      <Card className="flex-row items-center bg-blush">
        <View className="mr-4 h-14 w-14 items-center justify-center rounded-2xl bg-white">
          <UserRound size={26} color="#FF2D55" />
        </View>
        <View className="flex-1">
          <Text className="text-xs font-semibold uppercase tracking-wider text-brand">{isGuest ? "Gostujući profil" : "BeMove član"}</Text>
          <Text className="mt-1 text-lg font-extrabold text-ink">{fullName.trim() || "Postavi svoje ime"}</Text>
        </View>
      </Card>

      {isGuest ? (
        <>
          <SectionTitle title="Sačuvaj svoj napredak" />
          <Card>
            <Text className="mb-4 text-sm leading-5 text-muted">
              Poveži email i lozinku kako bi zadržao/la treninge, obroke i mjerenja ako promijeniš uređaj.
            </Text>
            <View className="gap-3">
              <TextInput
                className="rounded-2xl bg-canvas px-4 py-4 text-ink"
                placeholder="Email adresa"
                placeholderTextColor="#98989F"
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                value={accountEmail}
                onChangeText={setAccountEmail}
                editable={!saving}
              />
              <TextInput
                className="rounded-2xl bg-canvas px-4 py-4 text-ink"
                placeholder="Lozinka (najmanje 6 znakova)"
                placeholderTextColor="#98989F"
                secureTextEntry
                autoComplete="new-password"
                autoCapitalize="none"
                value={accountPassword}
                onChangeText={setAccountPassword}
                editable={!saving}
              />
              <PrimaryButton
                label={saving ? "Povezivanje..." : "Poveži email i sačuvaj"}
                onPress={() => void linkGuestAccount()}
                disabled={saving}
              />
            </View>
          </Card>
        </>
      ) : null}

      <SectionTitle title="Lični podaci" />
      <Card>
        <ProfileField
          label="Ime i prezime"
          placeholder="Unesi ime i prezime"
          value={fullName}
          onChangeText={(value) => {
            setFullName(value);
            setFormMessage(null);
          }}
          editable={!saving}
        />
      </Card>

      <SectionTitle title="Fitnes ciljevi" />
      <Card>
        <ProfileField
          label="Ciljana težina"
          placeholder="115"
          unit="kg"
          value={targetWeight}
          onChangeText={(value) => {
            setTargetWeight(value.replace(",", "."));
            setFormMessage(null);
          }}
          keyboardType="decimal-pad"
          editable={!saving}
        />
        <View className="mt-5">
          <ProfileField
            label="Dnevni cilj kalorija"
            placeholder="2200"
            unit="kcal"
            value={caloriesTarget}
            onChangeText={(value) => {
              setCaloriesTarget(value);
              setFormMessage(null);
            }}
            keyboardType="number-pad"
            editable={!saving}
          />
        </View>
        <View className="mt-5">
          <PrimaryButton
            label={saving ? "Spremanje..." : "Spremi promjene"}
            onPress={() => void saveChanges()}
            disabled={saving}
          />
        </View>
      </Card>

      <SectionTitle title="Trenutna težina" />
      <Card>
        <Text className="text-sm text-muted">Posljednji unos</Text>
        <Text className="mt-1 text-3xl font-extrabold text-ink">
          {latestWeight ? `${latestWeight.weight_kg.toFixed(1)} kg` : "Još nema unosa"}
        </Text>
        {latestWeight && (
          <Text className="mt-1 text-xs text-muted">
            {new Date(latestWeight.logged_at).toLocaleDateString()}
          </Text>
        )}
        <View className="mt-5">
          <ProfileField
            label="Dodaj novi unos trenutne težine"
            placeholder="npr. 118.5"
            unit="kg"
            value={currentWeight}
            onChangeText={(value) => {
              setCurrentWeight(value.replace(",", "."));
              setFormMessage(null);
            }}
            keyboardType="decimal-pad"
            editable={!saving}
          />
        </View>
        <Text className="mt-2 text-xs leading-5 text-muted">
          Unos se sprema zajedno s promjenama profila. Polje ostavi prazno ako ne želiš dodati mjerenje.
        </Text>
      </Card>

      {formMessage && (
        <View className="mt-4">
          {formMessage.kind === "error"
            ? <ErrorMessage message={formMessage.text} />
            : <Text accessibilityRole="text" className="rounded-2xl bg-[#EAF8EF] px-4 py-3 text-sm text-[#247A43]">{formMessage.text}</Text>}
        </View>
      )}
    </AppScreen>
  );
}

function ProfileField({
  label,
  placeholder,
  value,
  onChangeText,
  editable,
  keyboardType = "default",
  unit
}: {
  label: string;
  placeholder: string;
  value: string;
  onChangeText: (value: string) => void;
  editable: boolean;
  keyboardType?: "default" | "decimal-pad" | "number-pad";
  unit?: string;
}) {
  return (
    <View>
      <Text className="mb-2 text-sm font-semibold text-ink">{label}</Text>
      <View className="flex-row items-center rounded-2xl bg-canvas px-4">
        <TextInput
          className="min-h-12 flex-1 py-3 text-base text-ink"
          placeholder={placeholder}
          placeholderTextColor="#98989F"
          value={value}
          onChangeText={onChangeText}
          keyboardType={keyboardType}
          editable={editable}
        />
        {unit ? <Text className="ml-2 text-sm font-semibold text-muted">{unit}</Text> : null}
      </View>
    </View>
  );
}
