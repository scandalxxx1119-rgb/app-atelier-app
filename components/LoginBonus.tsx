import { useEffect, useRef, useState } from "react";
import { Animated, Text, TouchableOpacity, View } from "react-native";
import { supabase } from "@/lib/supabase";
import { useTheme } from "@/lib/theme";

type BonusResult = {
  awarded: boolean;
  points: number;
  bonus: number;
  streak: number;
  total_days: number;
  milestone: number;
};

export default function LoginBonus() {
  const { isDark } = useTheme();
  const [result, setResult] = useState<BonusResult | null>(null);
  const [visible, setVisible] = useState(false);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(40)).current;

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const { data: res } = await supabase.rpc("check_login_bonus");
      if (res && res.awarded) {
        setResult(res as BonusResult);
        setVisible(true);
        Animated.parallel([
          Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(translateY, { toValue: 0, duration: 300, useNativeDriver: true }),
        ]).start();
        const timer = setTimeout(() => hide(), 4000);
        return () => clearTimeout(timer);
      }
    });
  }, []);

  const hide = () => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 40, duration: 200, useNativeDriver: true }),
    ]).start(() => setVisible(false));
  };

  if (!visible || !result) return null;

  const isMilestone = result.milestone > 0;
  const totalPt = result.points + result.bonus;
  const bg = isMilestone ? "#7c3aed" : isDark ? "#27272a" : "#18181b";

  return (
    <Animated.View style={{
      position: "absolute", bottom: 90, left: 16, right: 16,
      opacity, transform: [{ translateY }], zIndex: 999,
    }}>
      <View style={{
        backgroundColor: bg, borderRadius: 16, padding: 14,
        flexDirection: "row", alignItems: "center", gap: 12,
        shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 8, elevation: 6,
      }}>
        <Text style={{ fontSize: 24 }}>{isMilestone ? "🎉" : "🎁"}</Text>
        <View style={{ flex: 1 }}>
          <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>
            {isMilestone ? `連続${result.milestone}日達成！ +${totalPt}pt` : `ログインボーナス +${totalPt}pt`}
          </Text>
          <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 12, marginTop: 2 }}>
            {result.streak}日連続ログイン中（累計{result.total_days}日）
          </Text>
        </View>
        <TouchableOpacity onPress={hide}>
          <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 18 }}>×</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}
