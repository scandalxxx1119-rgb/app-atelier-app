import { useRef, useState } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet,
  SafeAreaView, FlatList, Dimensions,
} from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTheme } from "@/lib/theme";

const { width } = Dimensions.get("window");

type Role = "supporter" | "developer";

type Slide = { emoji: string; title: string; desc: string };

const SLIDES: Record<Role, Slide[]> = {
  supporter: [
    {
      emoji: "💡",
      title: "欲しいアプリを投稿しよう",
      desc: "アイデアを投稿すると開発者が実現してくれるかも",
    },
    {
      emoji: "👏",
      title: "開発者を応援しよう",
      desc: "いいねやコメントで開発者の励みになります",
    },
  ],
  developer: [
    {
      emoji: "📦",
      title: "アプリを公開しよう",
      desc: "応援してくれる人があなたの作品を待っています",
    },
    {
      emoji: "💡",
      title: "アイデアに応えよう",
      desc: "ユーザーの声からヒントを得て次の作品を作ろう",
    },
  ],
};

export default function OnboardingScreen() {
  const router = useRouter();
  const { isDark } = useTheme();
  const s = styles(isDark);

  const [phase, setPhase] = useState<"select" | "slides">("select");
  const [role, setRole] = useState<Role>("supporter");
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  const slides = SLIDES[role];
  const isLast = currentIndex === slides.length - 1;

  const handleSelectRole = (r: Role) => {
    setRole(r);
    setCurrentIndex(0);
    setPhase("slides");
  };

  const finish = async () => {
    await AsyncStorage.setItem("user_role", role);
    router.replace("/(tabs)");
  };

  const handleNext = () => {
    if (isLast) {
      finish();
    } else {
      const next = currentIndex + 1;
      flatListRef.current?.scrollToIndex({ index: next, animated: true });
      setCurrentIndex(next);
    }
  };

  if (phase === "select") {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.inner}>
          <Text style={s.logo}>🎨</Text>
          <Text style={s.title}>App Atelierへようこそ</Text>
          <Text style={s.subtitle}>あなたはどちらですか？</Text>
          <View style={s.cards}>
            <TouchableOpacity style={s.card} onPress={() => handleSelectRole("supporter")}>
              <Text style={s.cardEmoji}>👀</Text>
              <Text style={s.cardTitle}>応援者</Text>
              <Text style={s.cardDesc}>開発者が作ったアプリを{"\n"}見に来た人</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.card, s.cardDev]} onPress={() => handleSelectRole("developer")}>
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

  return (
    <SafeAreaView style={s.container}>
      {/* スキップボタン */}
      <TouchableOpacity style={s.skipBtn} onPress={finish}>
        <Text style={s.skipBtnText}>スキップ</Text>
      </TouchableOpacity>

      <FlatList
        ref={flatListRef}
        data={slides}
        horizontal
        pagingEnabled
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        keyExtractor={(_, i) => String(i)}
        renderItem={({ item }) => (
          <View style={s.slide}>
            <Text style={s.slideEmoji}>{item.emoji}</Text>
            <Text style={s.slideTitle}>{item.title}</Text>
            <Text style={s.slideDesc}>{item.desc}</Text>
          </View>
        )}
      />

      {/* ドットインジケーター */}
      <View style={s.dots}>
        {slides.map((_, i) => (
          <View key={i} style={[s.dot, i === currentIndex && s.dotActive]} />
        ))}
      </View>

      {/* 次へ / はじめる */}
      <View style={s.bottomRow}>
        <TouchableOpacity style={s.nextBtn} onPress={handleNext}>
          <Text style={s.nextBtnText}>{isLast ? "はじめる" : "次へ →"}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = (isDark: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: isDark ? "#09090b" : "#f4f4f5" },
  // ---- select phase ----
  inner: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  logo: { fontSize: 56, marginBottom: 20 },
  title: { fontSize: 26, fontWeight: "800", color: isDark ? "#ffffff" : "#09090b", textAlign: "center", marginBottom: 8 },
  subtitle: { fontSize: 16, color: isDark ? "#a1a1aa" : "#71717a", textAlign: "center", marginBottom: 40 },
  cards: { width: "100%", gap: 16, marginBottom: 32 },
  card: {
    backgroundColor: isDark ? "#18181b" : "#ffffff",
    borderRadius: 20, padding: 28, alignItems: "center",
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
  // ---- slides phase ----
  skipBtn: { alignSelf: "flex-end", paddingHorizontal: 20, paddingVertical: 14 },
  skipBtnText: { fontSize: 14, color: isDark ? "#71717a" : "#a1a1aa" },
  slide: {
    width,
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
  },
  slideEmoji: { fontSize: 80, marginBottom: 32 },
  slideTitle: { fontSize: 24, fontWeight: "800", color: isDark ? "#ffffff" : "#09090b", textAlign: "center", marginBottom: 16, lineHeight: 32 },
  slideDesc: { fontSize: 15, color: isDark ? "#a1a1aa" : "#71717a", textAlign: "center", lineHeight: 24 },
  dots: { flexDirection: "row", justifyContent: "center", gap: 8, marginBottom: 16 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: isDark ? "#3f3f46" : "#d4d4d8" },
  dotActive: { backgroundColor: isDark ? "#ffffff" : "#09090b", width: 20 },
  bottomRow: { paddingHorizontal: 24, paddingBottom: 32 },
  nextBtn: {
    backgroundColor: isDark ? "#ffffff" : "#09090b",
    borderRadius: 14, paddingVertical: 16, alignItems: "center",
  },
  nextBtnText: { fontSize: 16, fontWeight: "700", color: isDark ? "#09090b" : "#ffffff" },
});
