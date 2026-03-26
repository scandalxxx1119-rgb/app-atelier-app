import { useEffect, useState, useCallback } from "react";
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, RefreshControl, Image,
} from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useTheme } from "@/lib/theme";
import Badge, { BadgeType } from "@/components/Badge";

type App = {
  id: string;
  name: string;
  tagline: string;
  icon_url: string | null;
  tags: string[] | null;
  likes_count: number;
  status: string | null;
  user_id: string;
  username?: string;
  badge?: string | null;
};

type Props = {
  tag: string;
  emptyMessage?: string;
};

export default function FilteredAppList({ tag, emptyMessage }: Props) {
  const { isDark } = useTheme();
  const s = styles(isDark);
  const router = useRouter();

  const [apps, setApps] = useState<App[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sort, setSort] = useState<"created_at" | "likes_count">("created_at");

  const fetchApps = useCallback(async () => {
    const { data } = await supabase
      .from("aa_apps")
      .select("id, name, tagline, icon_url, tags, likes_count, status, user_id")
      .contains("tags", [tag])
      .order(sort, { ascending: false })
      .limit(50);

    const appsData = (data as App[]) ?? [];
    const userIds = [...new Set(appsData.map((a) => a.user_id))];
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from("aa_profiles").select("id, username, badge").in("id", userIds);
      const usernameMap: Record<string, string> = {};
      const badgeMap: Record<string, string | null> = {};
      profiles?.forEach((p: { id: string; username: string; badge: string | null }) => {
        usernameMap[p.id] = p.username;
        badgeMap[p.id] = p.badge;
      });
      setApps(appsData.map((a) => ({ ...a, username: usernameMap[a.user_id] ?? "anonymous", badge: badgeMap[a.user_id] ?? null })));
    } else {
      setApps(appsData);
    }
  }, [tag, sort]);

  useEffect(() => {
    setLoading(true);
    fetchApps().finally(() => setLoading(false));
  }, [fetchApps]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchApps();
    setRefreshing(false);
  };

  const statusColor = (status: string | null) => {
    if (!status || status === "released") return { bg: isDark ? "#14532d" : "#dcfce7", text: isDark ? "#86efac" : "#16a34a", label: "✓ リリース済み" };
    if (status === "beta") return { bg: isDark ? "#1e3a5f" : "#dbeafe", text: isDark ? "#93c5fd" : "#2563eb", label: "β" };
    return { bg: isDark ? "#451a03" : "#fef3c7", text: isDark ? "#fcd34d" : "#d97706", label: "🚧" };
  };

  const renderItem = ({ item, index }: { item: App; index: number }) => {
    const sc = statusColor(item.status);
    return (
      <TouchableOpacity style={s.card} onPress={() => router.push(`/apps/${item.id}`)}>
        <View style={s.rankNum}>
          <Text style={s.rankText}>{index + 1}</Text>
        </View>
        {item.icon_url ? (
          <Image source={{ uri: item.icon_url }} style={s.icon} />
        ) : (
          <View style={s.iconPlaceholder}>
            <Text style={s.iconInitial}>{item.name[0]}</Text>
          </View>
        )}
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={s.appName} numberOfLines={1}>{item.name}</Text>
          <Text style={s.appTagline} numberOfLines={1}>{item.tagline}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
            <TouchableOpacity onPress={() => router.push(`/users/${item.username}`)}>
              <Text style={s.username}>by {item.username}</Text>
            </TouchableOpacity>
            {item.badge && <Badge badge={item.badge as BadgeType} size="xs" />}
            <View style={[s.statusBadge, { backgroundColor: sc.bg }]}>
              <Text style={[s.statusText, { color: sc.text }]}>{sc.label}</Text>
            </View>
          </View>
        </View>
        <View style={{ alignItems: "center", gap: 2 }}>
          <Text style={s.heartIcon}>♥</Text>
          <Text style={s.likesCount}>{item.likes_count}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={s.container}>
      {/* Sort bar */}
      <View style={s.sortRow}>
        {(["created_at", "likes_count"] as const).map((opt) => (
          <TouchableOpacity
            key={opt}
            style={[s.sortBtn, sort === opt && s.sortBtnActive]}
            onPress={() => setSort(opt)}
          >
            <Text style={[s.sortBtnText, sort === opt && s.sortBtnTextActive]}>
              {opt === "created_at" ? "新着" : "人気"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={apps}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={{ paddingBottom: 20 }}
        ItemSeparatorComponent={() => <View style={s.separator} />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <View style={{ alignItems: "center", paddingTop: 80 }}>
            <Text style={s.emptyText}>{loading ? "読み込み中..." : (emptyMessage ?? "アプリが見つかりません")}</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = (isDark: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: isDark ? "#09090b" : "#f2f2f7" },
  sortRow: { flexDirection: "row", paddingHorizontal: 16, paddingVertical: 10, gap: 8, backgroundColor: isDark ? "#18181b" : "#ffffff", borderBottomWidth: 1, borderBottomColor: isDark ? "#27272a" : "#e4e4e7" },
  sortBtn: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: isDark ? "#3f3f46" : "#e4e4e7" },
  sortBtnActive: { backgroundColor: isDark ? "#ffffff" : "#09090b", borderColor: "transparent" },
  sortBtnText: { fontSize: 13, fontWeight: "500", color: isDark ? "#a1a1aa" : "#71717a" },
  sortBtnTextActive: { color: isDark ? "#09090b" : "#ffffff" },
  card: { flexDirection: "row", alignItems: "center", paddingVertical: 12, paddingHorizontal: 16, backgroundColor: isDark ? "#18181b" : "#ffffff" },
  rankNum: { width: 24, alignItems: "center", marginRight: 8 },
  rankText: { fontSize: 15, fontWeight: "700", color: isDark ? "#52525b" : "#d4d4d8" },
  icon: { width: 56, height: 56, borderRadius: 12 },
  iconPlaceholder: { width: 56, height: 56, borderRadius: 12, backgroundColor: isDark ? "#27272a" : "#f4f4f5", alignItems: "center", justifyContent: "center" },
  iconInitial: { fontSize: 22, fontWeight: "700", color: isDark ? "#71717a" : "#a1a1aa" },
  appName: { fontSize: 15, fontWeight: "600", color: isDark ? "#ffffff" : "#09090b" },
  appTagline: { fontSize: 12, color: isDark ? "#71717a" : "#a1a1aa", marginTop: 2 },
  username: { fontSize: 11, color: isDark ? "#52525b" : "#a1a1aa" },
  statusBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 99 },
  statusText: { fontSize: 10, fontWeight: "600" },
  heartIcon: { fontSize: 14, color: "#ef4444" },
  likesCount: { fontSize: 11, color: isDark ? "#71717a" : "#a1a1aa" },
  separator: { height: 1, backgroundColor: isDark ? "#27272a" : "#f2f2f7", marginLeft: 16 + 24 + 8 + 56 + 12 },
  emptyText: { fontSize: 14, color: isDark ? "#71717a" : "#a1a1aa" },
});
