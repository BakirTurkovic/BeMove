import type { PropsWithChildren, ReactNode } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, usePathname } from "expo-router";
import { CalendarDays, Flame, HeartPulse, House, Scale, UserRound } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";

const tabs = [
  { label: "Danas", path: "/", icon: House },
  { label: "Kalendar", path: "/calendar", icon: CalendarDays },
  { label: "Obroci", path: "/meals", icon: Flame },
  { label: "Trening", path: "/workouts", icon: HeartPulse },
  { label: "Težina", path: "/weight", icon: Scale },
  { label: "Profil", path: "/profile", icon: UserRound }
] as const;

export function AppScreen({
  children,
  scroll = true,
  showTabs = true
}: PropsWithChildren<{ scroll?: boolean; showTabs?: boolean }>) {
  const pathname = usePathname();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#F8F9FA" }} edges={["top", "bottom"]}>
      {scroll ? (
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingHorizontal: 22, paddingTop: 12, paddingBottom: 26 }}
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      ) : (
        <View className="flex-1 px-[22px] pt-3">{children}</View>
      )}
      {showTabs && (
        <View
          className="mx-3 mb-2 flex-row rounded-[28px] border border-white bg-white/95 px-2 pb-2 pt-3"
          style={{
            shadowColor: "#1C1C1E",
            shadowOffset: { width: 0, height: 5 },
            shadowOpacity: 0.12,
            shadowRadius: 18,
            elevation: 8
          }}
        >
          {tabs.map(({ label, path, icon: Icon }) => {
            const active = pathname === path || (path === "/" && pathname === "/");
            return (
              <Pressable
                key={path}
                onPress={() => router.replace(path)}
                className="flex-1 items-center gap-1"
                accessibilityRole="button"
                accessibilityLabel={label}
              >
                <Icon size={21} color={active ? "#FF2D55" : "#98989F"} strokeWidth={active ? 2.4 : 2} />
                <Text className={`text-[10px] font-semibold ${active ? "text-brand" : "text-muted"}`}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}
    </SafeAreaView>
  );
}

export function Header({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <View className="mb-4 flex-row items-center justify-between">
      <View className="flex-1">
        {subtitle && <Text className="mb-1 text-xs font-semibold uppercase tracking-[1.4px] text-muted">{subtitle}</Text>}
        <Text className="text-[28px] font-extrabold tracking-tight text-ink">{title}</Text>
      </View>
      {right}
    </View>
  );
}

export function Card({ children, className = "" }: PropsWithChildren<{ className?: string }>) {
  const hasBackgroundClass = /(?:^|\s)bg-/.test(className);
  return (
    <View
      className={`rounded-3xl p-5 ${hasBackgroundClass ? "" : "bg-white"} ${className}`}
      style={{
        shadowColor: "#1C1C1E",
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.06,
        shadowRadius: 12,
        elevation: 3
      }}
    >
      {children}
    </View>
  );
}

export function SectionTitle({ title, action, compact = false }: { title: string; action?: string; compact?: boolean }) {
  return (
    <View className={`mb-3 flex-row items-center justify-between ${compact ? "mt-0" : "mt-7"}`}>
      <Text className="text-lg font-bold text-ink">{title}</Text>
      {action ? <Text className="text-sm font-semibold text-brand">{action}</Text> : null}
    </View>
  );
}

export function PrimaryButton({
  label,
  onPress,
  secondary = false,
  disabled = false
}: {
  label: string;
  onPress: () => void;
  secondary?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className={`overflow-hidden rounded-2xl ${disabled ? "opacity-50" : ""}`}
      style={!secondary ? {
        shadowColor: "#E60023",
        shadowOffset: { width: 0, height: 5 },
        shadowOpacity: 0.2,
        shadowRadius: 10,
        elevation: 4
      } : undefined}
    >
      {secondary ? (
        <View className="items-center justify-center bg-blush px-5 py-4">
          <Text className="font-bold text-brand">{label}</Text>
        </View>
      ) : (
        <LinearGradient
          colors={["#FF3B30", "#FF6B00"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          className="items-center justify-center px-5 py-4"
        >
          <Text className="font-bold text-white">{label}</Text>
        </LinearGradient>
      )}
    </Pressable>
  );
}

export function LoadingState() {
  return <ActivityIndicator className="mt-16" color="#FF2D55" size="large" />;
}

export function DataErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Card className="mt-8">
      <Text accessibilityRole="alert" className="text-base font-bold text-ink">
        Podaci se nisu mogli učitati
      </Text>
      <Text className="mt-2 text-sm leading-5 text-muted">{message}</Text>
      <View className="mt-4">
        <PrimaryButton label="Pokušaj ponovo" onPress={onRetry} />
      </View>
    </Card>
  );
}

export function ErrorMessage({ message }: { message: string }) {
  return (
    <Text accessibilityRole="alert" className="mb-4 rounded-2xl bg-[#FFF0F2] px-4 py-3 text-sm leading-5 text-[#B4233A]">
      {message}
    </Text>
  );
}

export function Metric({ label, value, unit }: { label: string; value: string | number; unit?: string }) {
  return (
    <View className="flex-1">
      <Text className="text-xs font-medium text-muted">{label}</Text>
      <Text className="mt-1 text-xl font-extrabold text-ink">
        {value}
        {unit ? <Text className="text-xs font-semibold text-muted"> {unit}</Text> : null}
      </Text>
    </View>
  );
}
