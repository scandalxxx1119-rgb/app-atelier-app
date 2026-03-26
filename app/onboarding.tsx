import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView } from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTheme } from "@/lib/theme";

export default function OnboardingScreen() {
  const router = useRouter();
  const { isDark } = useTheme();
  const s = styles(isDark);

  const handleSelect = async (role: "supporter" | "developer") => {
    await AsyncStorage.setItem("user_role", role);
    router.replace("/(tabs)");
  };

  return (
    <SafeAreaView style={s.container}>
      <View style={s.inner}>
        <Text style={s.logo}>🎨</Text>
        <Text style={s.title}>App Atelierへようこそ</Text>
        <Text style={s.subtitle}>あなたはどちらですか？</Text>

        <View style={s.cards}>
          <TouchableOpacity style={s.card} onPress={() => handleSelect("supporter")}>
            <Text style={s.cardEmoji}>👀</Text>
            <Text style={s.cardTitle}>応援者</Text>
            <Text style={s.cardDesc}>開発者が作ったアプリを{"\n"}見に来た人</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[s.card, s.cardDev]} onPress={() => handleSelect("developer")}>
            <Text style={s.cardEmoji}>🛠️</Text>
            <Text style={s.cardTitle}>開発者</Text>
            <Text style={s.cardDesc}>アプリを作っている人</Text>
          </TouchableOpacity>
        </View>

        <Text style={s.note}>あとから変更できます</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = (isDark: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: isDark ? "#09090b" : "#f4f4f5" },
  inner: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  logo: { fontSize: 56, marginBottom: 20 },
  title: { fontSize: 26, fontWeight: "800", color: isDark ? "#ffffff" : "#09090b", textAlign: "center", marginBottom: 8 },
  subtitle: { fontSize: 16, color: isDark ? "#a1a1aa" : "#71717a", textAlign: "center", marginBottom: 40 },
  cards: { width: "100%", gap: 16, marginBottom: 32 },
  card: {
    backgroundColor: isDark ? "#18181b" : "#ffffff",
    borderRadius: 20, padding: 28,
    alignItems: "center",
    borderWidth: 2, borderColor: isDark ? "#27272a" : "#e4e4e7",
  },
  cardDev: {
    borderColor: isDark ? "#7c3aed" : "#a78bfa",
    backgroundColor: isDark ? "#2e1065" : "#f5f3ff",
  },
  cardEmoji: { fontSize: 44, marginBottom: 12 },
  cardTitle: { fontSize: 22, fontWeight: "700", color: isDark ? "#ffffff" : "#09090b", marginBottom: 8 },
  cardDesc: { fontSize: 14, color: isDark ? "#a1a1aa" : "#71717a", textAlign: "center", lineHeight: 20 },
  note: { fontSize: 12, color: isDark ? "#52525b" : "#a1a1aa" },
});
