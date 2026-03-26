import { useEffect, useState, useCallback } from "react";
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, RefreshControl, Image, ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useTheme } from "@/lib/theme";

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
  tester_slots?: number;
};

type ActivityItem = {
  key: string;
  type: "comment" | "update" | "new_app";
  text: string;
  app_id: string;
  app_name: string;
  created_at: string;
};

export default function HomeScreen() {
  const { isDark } = useTheme();
  const s = styles(isDark);
  const router = useRouter();

  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [testerApps, setTesterApps] = useState<App[]>([]);
  const [newApps, setNewApps] = useState<App[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    // Activity feed: recent comments
    const { data: recentComments } = await supabase
      .from("aa_comments")
      .select("id, content, app_id, user_id, created_at")
      .order("created_at", { ascending: false })
      .limit(10);

    // Activity feed: recent app updates
    const { data: recentUpdates } = await supabase
      .from("aa_app_updates")
      .select("id, title, app_id, user_id, created_at")
      .order("created_at", { ascending: false })
      .limit(5);

    // Resolve usernames and app names for activity
    const commentAppIds = [...new Set((recentComments ?? []).map((c: { app_id: string }) => c.app_id))];
    const updateAppIds = [...new Set((recentUpdates ?? []).map((u: { app_id: string }) => u.app_id))];
    const allActivityAppIds = [...new Set([...commentAppIds, ...updateAppIds])];

    const allUserIds = [
      ...new Set([
        ...(recentComments ?? []).map((c: { user_id: string }) => c.user_id),
        ...(recentUpdates ?? []).map((u: { user_id: string }) => u.user_id),
      ])
    ];

    const [appNameRes, userNameRes] = await Promise.all([
      allActivityAppIds.length > 0
        ? supabase.from("aa_apps").select("id, name").in("id", allActivityAppIds)
        : Promise.resolve({ data: [] }),
      allUserIds.length > 0
        ? supabase.from("aa_profiles").select("id, username").in("id", allUserIds)
        : Promise.resolve({ data: [] }),
    ]);

    const appNameMap: Record<string, string> = {};
    (appNameRes.data ?? []).forEach((a: { id: string; name: string }) => { appNameMap[a.id] = a.name; });
    const userNameMap: Record<string, string> = {};
    (userNameRes.data ?? []).forEach((p: { id: string; username: string }) => { userNameMap[p.id] = p.username; });

    const activityItems: ActivityItem[] = [
      ...(recentComments ?? []).map((c: { id: string; app_id: string; user_id: string; created_at: string }) => ({
        key: `comment-${c.id}`,
        type: "comment" as const,
        text: `${userNameMap[c.user_id] ?? "ユーザー"} がコメント`,
        app_id: c.app_id,
        app_name: appNameMap[c.app_id] ?? "",
        created_at: c.created_at,
      })),
      ...(recentUpdates ?? []).map((u: { id: string; app_id: string; user_id: string; title: string; created_at: string }) => ({
        key: `update-${u.id}`,
        type: "update" as const,
        text: `${userNameMap[u.user_id] ?? "開発者"} がアップデート`,
        app_id: u.app_id,
        app_name: appNameMap[u.app_id] ?? "",
        created_at: u.created_at,
      })),
    ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 8);

    setActivity(activityItems);

    // Tester recruiting apps (unique to this platform)
    const { data: tApps } = await supabase
      .from("aa_apps")
      .select("id, name, tagline, icon_url, tags, likes_count, status, user_id, tester_slots")
      .gt("tester_slots", 0)
      .order("created_at", { ascending: false })
      .limit(10);

    if (tApps && tApps.length > 0) {
      const tUserIds = [...new Set(tApps.map((a: App) => a.user_id))];
      const { data: tProfiles } = await supabase.from("aa_profiles").select("id, username").in("id", tUserIds);
      const tMap: Record<string, string> = {};
      tProfiles?.forEach((p: { id: string; username: string }) => { tMap[p.id] = p.username; });
      setTesterApps(tApps.map((a: App) => ({ ...a, username: tMap[a.user_id] ?? "anonymous" })));
    }

    // New apps
    const { data: newRes } = await supabase
      .from("aa_apps")
      .select("id, name, tagline, icon_url, tags, likes_count, status, user_id")
      .order("created_at", { ascending: false })
      .limit(10);

    if (newRes && newRes.length > 0) {
      const nUserIds = [...new Set(newRes.map((a: App) => a.user_id))];
      const { data: nProfiles } = await supabase.from("aa_profiles").select("id, username").in("id", nUserIds);
      const nMap: Record<string, string> = {};
      nProfiles?.forEach((p: { id: string; username: string }) => { nMap[p.id] = p.username; });
      setNewApps(newRes.map((a: App) => ({ ...a, username: nMap[a.user_id] ?? "anonymous" })));
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchAll().finally(() => setLoading(false));
  }, [fetchAll]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchAll();
    setRefreshing(false);
  };

  const AppIcon = ({ item, size = 44 }: { item: App; size?: number }) => (
    item.icon_url ? (
      <Image source={{ uri: item.icon_url }} style={{ width: size, height: size, borderRadius: size * 0.22 }} />
    ) : (
      <View style={[s.iconPlaceholder, { width: size, height: size, borderRadius: size * 0.22 }]}>
        <Text style={{ fontSize: size * 0.4, fontWeight: "700", color: isDark ? "#71717a" : "#a1a1aa" }}>
          {item.name[0]}
        </Text>
      </View>
    )
  );

  const activityIcon = (type: ActivityItem["type"]) => type === "comment" ? "💬" : "🔄";

  const SectionHeader = ({ title, subtitle }: { title: string; subtitle?: string }) => (
    <View style={s.sectionHeader}>
      <Text style={s.sectionTitle}>{title}</Text>
      {subtitle && <Text style={s.sectionSubtitle}>{subtitle}</Text>}
    </View>
  );

  const Divider = () => <View style={s.divider} />;

  return (
    <ScrollView
      style={s.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      showsVerticalScrollIndicator={false}
    >
      {loading ? (
        <View style={{ padding: 60, alignItems: "center" }}>
          <Text style={s.loadingText}>読み込み中...</Text>
        </View>
      ) : (
        <>
          {/* Activity Feed */}
          {activity.length > 0 && (
            <View style={s.section}>
              <SectionHeader title="コミュニティの動き" subtitle="開発者たちの最新アクティビティ" />
              {activity.map((item, index) => (
                <View key={item.key}>
                  <TouchableOpacity
                    style={s.activityRow}
                    onPress={() => router.push(`/apps/${item.app_id}`)}
                  >
                    <Text style={s.activityIcon}>{activityIcon(item.type)}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={s.activityText} numberOfLines={1}>{item.text}</Text>
                      <Text style={s.activityAppName} numberOfLines={1}>「{item.app_name}」</Text>
                    </View>
                  </TouchableOpacity>
                  {index < activity.length - 1 && <Divider />}
                </View>
              ))}
            </View>
          )}

          {/* Tester Recruiting (unique feature) */}
          {testerApps.length > 0 && (
            <View style={s.section}>
              <SectionHeader title="🧪 テスター募集中" subtitle="開発者が一緒に試してくれる人を探しています" />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 12, paddingBottom: 4 }}>
                {testerApps.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={s.testerCard}
                    onPress={() => router.push(`/apps/${item.id}`)}
                  >
                    <AppIcon item={item} size={48} />
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={s.testerCardName} numberOfLines={1}>{item.name}</Text>
                      <Text style={s.testerCardUser} numberOfLines={1}>by {item.username}</Text>
                    </View>
                    <View style={s.testerBadge}>
                      <Text style={s.testerBadgeText}>募集中</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* New Posts */}
          {newApps.length > 0 && (
            <View style={[s.section, { marginBottom: 32 }]}>
              <SectionHeader title="最新の投稿" subtitle="開発者が公開した作品" />
              <View style={{ paddingHorizontal: 16 }}>
                {newApps.slice(0, 8).map((item, index) => (
                  <View key={item.id}>
                    <TouchableOpacity style={s.rowCard} onPress={() => router.push(`/apps/${item.id}`)}>
                      <AppIcon item={item} size={48} />
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={s.rowName} numberOfLines={1}>{item.name}</Text>
                        <Text style={s.rowTagline} numberOfLines={1}>{item.tagline}</Text>
                        <Text style={s.rowUser} numberOfLines={1}>by {(item as App & { username?: string }).username}</Text>
                      </View>
                      <Text style={s.likeCount}>♥ {item.likes_count}</Text>
                    </TouchableOpacity>
                    {index < Math.min(newApps.length, 8) - 1 && <Divider />}
                  </View>
                ))}
              </View>
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = (isDark: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: isDark ? "#09090b" : "#f2f2f7" },
  section: {
    backgroundColor: isDark ? "#18181b" : "#ffffff",
    marginHorizontal: 16, marginTop: 16,
    borderRadius: 16, overflow: "hidden",
    borderWidth: 1, borderColor: isDark ? "#27272a" : "#e4e4e7",
  },
  sectionHeader: {
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10,
    borderBottomWidth: 1, borderBottomColor: isDark ? "#27272a" : "#f2f2f7",
  },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: isDark ? "#ffffff" : "#09090b" },
  sectionSubtitle: { fontSize: 11, color: isDark ? "#71717a" : "#a1a1aa", marginTop: 2 },
  activityRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingHorizontal: 16, paddingVertical: 11,
  },
  activityIcon: { fontSize: 18, width: 24, textAlign: "center" },
  activityText: { fontSize: 13, color: isDark ? "#d4d4d8" : "#3f3f46" },
  activityAppName: { fontSize: 12, color: isDark ? "#71717a" : "#a1a1aa", marginTop: 1 },
  testerCard: {
    width: 220, flexDirection: "row", alignItems: "center",
    backgroundColor: isDark ? "#0c1a2e" : "#eff6ff",
    borderWidth: 1, borderColor: isDark ? "#1e3a5f" : "#bfdbfe",
    borderRadius: 12, padding: 12,
  },
  testerCardName: { fontSize: 13, fontWeight: "600", color: isDark ? "#ffffff" : "#09090b" },
  testerCardUser: { fontSize: 11, color: isDark ? "#60a5fa" : "#3b82f6", marginTop: 2 },
  testerBadge: {
    backgroundColor: isDark ? "#1e3a5f" : "#dbeafe",
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99, marginLeft: 6,
  },
  testerBadgeText: { fontSize: 10, fontWeight: "600", color: isDark ? "#93c5fd" : "#2563eb" },
  iconPlaceholder: {
    backgroundColor: isDark ? "#27272a" : "#f4f4f5",
    alignItems: "center", justifyContent: "center",
  },
  rowCard: { flexDirection: "row", alignItems: "center", paddingVertical: 11 },
  rowName: { fontSize: 14, fontWeight: "600", color: isDark ? "#ffffff" : "#09090b" },
  rowTagline: { fontSize: 12, color: isDark ? "#71717a" : "#a1a1aa", marginTop: 1 },
  rowUser: { fontSize: 11, color: isDark ? "#52525b" : "#a1a1aa", marginTop: 1 },
  likeCount: { fontSize: 12, color: "#ef4444" },
  divider: { height: 1, backgroundColor: isDark ? "#27272a" : "#f2f2f7" },
  loadingText: { fontSize: 14, color: isDark ? "#71717a" : "#a1a1aa" },
});
