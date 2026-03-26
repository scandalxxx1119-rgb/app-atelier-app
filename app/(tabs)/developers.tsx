import { useEffect, useState, useCallback } from "react";
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, RefreshControl, Image,
} from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useTheme } from "@/lib/theme";
import Badge, { BadgeType } from "@/components/Badge";

type Developer = {
  id: string;
  username: string;
  bio: string | null;
  avatar_url: string | null;
  badge: string | null;
  created_at: string;
  app_count: number;
  latest_app_name: string | null;
  latest_app_icon: string | null;
};

export default function DevelopersScreen() {
  const { isDark } = useTheme();
  const s = styles(isDark);
  const router = useRouter();

  const [developers, setDevelopers] = useState<Developer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sort, setSort] = useState<"created_at" | "app_count">("created_at");

  const fetchDevelopers = useCallback(async () => {
    const { data: profiles } = await supabase
      .from("aa_profiles")
      .select("id, username, bio, avatar_url, badge, created_at")
      .not("username", "is", null);

    if (!profiles || profiles.length === 0) {
      setDevelopers([]);
      return;
    }

    const userIds = profiles.map((p: { id: string }) => p.id);

    const { data: apps } = await supabase
      .from("aa_apps")
      .select("id, user_id, name, icon_url, created_at")
      .in("user_id", userIds)
      .order("created_at", { ascending: false });

    const appCountMap: Record<string, number> = {};
    const latestAppMap: Record<string, { name: string; icon_url: string | null }> = {};

    (apps ?? []).forEach((app: { user_id: string; name: string; icon_url: string | null }) => {
      if (!latestAppMap[app.user_id]) {
        latestAppMap[app.user_id] = { name: app.name, icon_url: app.icon_url };
      }
      appCountMap[app.user_id] = (appCountMap[app.user_id] ?? 0) + 1;
    });

    let devList: Developer[] = profiles.map((p: {
      id: string; username: string; bio: string | null;
      avatar_url: string | null; badge: string | null; created_at: string;
    }) => ({
      id: p.id,
      username: p.username,
      bio: p.bio,
      avatar_url: p.avatar_url,
      badge: p.badge,
      created_at: p.created_at,
      app_count: appCountMap[p.id] ?? 0,
      latest_app_name: latestAppMap[p.id]?.name ?? null,
      latest_app_icon: latestAppMap[p.id]?.icon_url ?? null,
    }));

    if (sort === "app_count") {
      devList = devList.sort((a, b) => b.app_count - a.app_count);
    } else {
      devList = devList.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    }

    setDevelopers(devList);
  }, [sort]);

  useEffect(() => {
    setLoading(true);
    fetchDevelopers().finally(() => setLoading(false));
  }, [fetchDevelopers]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchDevelopers();
    setRefreshing(false);
  };

  const renderItem = ({ item }: { item: Developer }) => (
    <TouchableOpacity style={s.card} onPress={() => router.push(`/users/${item.username}`)}>
      {item.avatar_url ? (
        <Image source={{ uri: item.avatar_url }} style={s.avatar} />
      ) : (
        <View style={s.avatarPlaceholder}>
          <Text style={s.avatarInitial}>{item.username[0].toUpperCase()}</Text>
        </View>
      )}
      <View style={{ flex: 1, marginLeft: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <Text style={s.username} numberOfLines={1}>{item.username}</Text>
          {item.badge && <Badge badge={item.badge as BadgeType} size="xs" />}
        </View>
        {item.bio ? (
          <Text style={s.bio} numberOfLines={1}>{item.bio}</Text>
        ) : null}
        {item.latest_app_name && (
          <View style={s.latestApp}>
            {item.latest_app_icon ? (
              <Image source={{ uri: item.latest_app_icon }} style={s.latestAppIcon} />
            ) : null}
            <Text style={s.latestAppName} numberOfLines={1}>{item.latest_app_name}</Text>
          </View>
        )}
      </View>
      <View style={{ alignItems: "center", marginLeft: 8 }}>
        <Text style={s.appCount}>{item.app_count}</Text>
        <Text style={s.appCountLabel}>作品</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={s.container}>
      <View style={s.sortRow}>
        {([["created_at", "新着"], ["app_count", "投稿数"]] as [string, string][]).map(([opt, label]) => (
          <TouchableOpacity
            key={opt}
            style={[s.sortBtn, sort === opt && s.sortBtnActive]}
            onPress={() => setSort(opt as "created_at" | "app_count")}
          >
            <Text style={[s.sortBtnText, sort === opt && s.sortBtnTextActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <FlatList
        data={developers}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ItemSeparatorComponent={() => <View style={s.separator} />}
        contentContainerStyle={{ paddingBottom: 20 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <View style={{ alignItems: "center", paddingTop: 80 }}>
            <Text style={s.emptyText}>{loading ? "読み込み中..." : "開発者が見つかりません"}</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = (isDark: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: isDark ? "#09090b" : "#f2f2f7" },
  sortRow: {
    flexDirection: "row", paddingHorizontal: 16, paddingVertical: 10, gap: 8,
    backgroundColor: isDark ? "#18181b" : "#ffffff",
    borderBottomWidth: 1, borderBottomColor: isDark ? "#27272a" : "#e4e4e7",
  },
  sortBtn: {
    paddingHorizontal: 16, paddingVertical: 7, borderRadius: 8,
    borderWidth: 1, borderColor: isDark ? "#3f3f46" : "#e4e4e7",
  },
  sortBtnActive: { backgroundColor: isDark ? "#ffffff" : "#09090b", borderColor: "transparent" },
  sortBtnText: { fontSize: 13, fontWeight: "500", color: isDark ? "#a1a1aa" : "#71717a" },
  sortBtnTextActive: { color: isDark ? "#09090b" : "#ffffff" },
  card: {
    flexDirection: "row", alignItems: "center",
    paddingVertical: 14, paddingHorizontal: 16,
    backgroundColor: isDark ? "#18181b" : "#ffffff",
  },
  avatar: { width: 52, height: 52, borderRadius: 26 },
  avatarPlaceholder: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: isDark ? "#27272a" : "#e4e4e7",
    alignItems: "center", justifyContent: "center",
  },
  avatarInitial: { fontSize: 20, fontWeight: "700", color: isDark ? "#71717a" : "#a1a1aa" },
  username: { fontSize: 15, fontWeight: "600", color: isDark ? "#ffffff" : "#09090b" },
  bio: { fontSize: 12, color: isDark ? "#71717a" : "#a1a1aa", marginTop: 2 },
  latestApp: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 5 },
  latestAppIcon: { width: 18, height: 18, borderRadius: 4 },
  latestAppName: { fontSize: 11, color: isDark ? "#52525b" : "#a1a1aa" },
  appCount: { fontSize: 18, fontWeight: "700", color: isDark ? "#ffffff" : "#09090b" },
  appCountLabel: { fontSize: 10, color: isDark ? "#52525b" : "#a1a1aa" },
  separator: { height: 1, backgroundColor: isDark ? "#27272a" : "#f2f2f7" },
  emptyText: { fontSize: 14, color: isDark ? "#71717a" : "#a1a1aa" },
});
