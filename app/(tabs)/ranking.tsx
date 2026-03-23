import { useEffect, useState, useCallback } from "react";
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, RefreshControl, Image,
} from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useTheme } from "@/lib/theme";

type RankedApp = {
  id: string;
  name: string;
  tagline: string;
  icon_url: string | null;
  likes_count: number;
  user_id: string;
  username?: string;
};

const MEDAL = ["🥇", "🥈", "🥉"];

export default function RankingScreen() {
  const { isDark } = useTheme();
  const s = styles(isDark);
  const router = useRouter();
  const [apps, setApps] = useState<RankedApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod] = useState<"week" | "month" | "all">("month");

  const fetchRanking = useCallback(async () => {
    let query = supabase
      .from("aa_apps")
      .select("id, name, tagline, icon_url, likes_count, user_id")
      .eq("status", "approved")
      .order("likes_count", { ascending: false })
      .limit(50);

    const { data } = await query;
    if (!data) { setLoading(false); setRefreshing(false); return; }

    const userIds = [...new Set(data.map((a: RankedApp) => a.user_id))];
    const { data: profiles } = await supabase
      .from("aa_profiles").select("id, username").in("id", userIds);

    const profileMap: Record<string, string> = {};
    profiles?.forEach((p: { id: string; username: string }) => { profileMap[p.id] = p.username; });

    setApps(data.map((a: RankedApp) => ({ ...a, username: profileMap[a.user_id] ?? "匿名" })));
    setLoading(false);
    setRefreshing(false);
  }, [period]);

  useEffect(() => { fetchRanking(); }, [fetchRanking]);

  const renderItem = ({ item, index }: { item: RankedApp; index: number }) => (
    <TouchableOpacity style={s.card} onPress={() => router.push(`/apps/${item.id}`)}>
      <View style={s.rank}>
        {index < 3 ? (
          <Text style={{ fontSize: 22 }}>{MEDAL[index]}</Text>
        ) : (
          <Text style={s.rankNum}>{index + 1}</Text>
        )}
      </View>
      {item.icon_url ? (
        <Image source={{ uri: item.icon_url }} style={s.icon} />
      ) : (
        <View style={[s.icon, s.iconPlaceholder]}>
          <Text style={{ fontSize: 20 }}>📱</Text>
        </View>
      )}
      <View style={s.info}>
        <Text style={s.name} numberOfLines={1}>{item.name}</Text>
        <Text style={s.tagline} numberOfLines={1}>{item.tagline}</Text>
        <Text style={s.meta}>{item.username}</Text>
      </View>
      <View style={s.likes}>
        <Text style={s.likesCount}>{item.likes_count}</Text>
        <Text style={s.likesTxt}>いいね</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={s.container}>
      <FlatList
        data={apps}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchRanking(); }} />}
        ListEmptyComponent={
          !loading ? <Text style={s.emptyTxt}>アプリがありません</Text> : null
        }
        contentContainerStyle={{ padding: 16, gap: 10 }}
      />
    </View>
  );
}

const styles = (isDark: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: isDark ? "#09090b" : "#f4f4f5" },
  card: {
    backgroundColor: isDark ? "#18181b" : "#fff", borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: isDark ? "#27272a" : "#e4e4e7",
    flexDirection: "row", alignItems: "center", gap: 12,
  },
  rank: { width: 32, alignItems: "center" },
  rankNum: { color: "#71717a", fontWeight: "700", fontSize: 16 },
  icon: { width: 48, height: 48, borderRadius: 10 },
  iconPlaceholder: {
    backgroundColor: isDark ? "#27272a" : "#f4f4f5",
    alignItems: "center", justifyContent: "center",
  },
  info: { flex: 1 },
  name: { color: isDark ? "#fff" : "#09090b", fontWeight: "600", fontSize: 14 },
  tagline: { color: isDark ? "#a1a1aa" : "#71717a", fontSize: 12, marginTop: 2 },
  meta: { color: "#71717a", fontSize: 11, marginTop: 4 },
  likes: { alignItems: "center" },
  likesCount: { color: isDark ? "#fff" : "#09090b", fontWeight: "700", fontSize: 16 },
  likesTxt: { color: "#71717a", fontSize: 10 },
  emptyTxt: { color: "#71717a", textAlign: "center", marginTop: 40 },
});
