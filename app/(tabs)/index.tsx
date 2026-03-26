import { useEffect, useState, useCallback } from "react";
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, RefreshControl, Image, ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useTheme } from "@/lib/theme";
import AsyncStorage from "@react-native-async-storage/async-storage";

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
  comment_count?: number;
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
  const [isDeveloper, setIsDeveloper] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem("user_role").then((role) => setIsDeveloper(role === "developer"));
  }, []);

  const fetchAll = useCallback(async () => {
    // フォロー中ユーザーIDを取得
    const { data: authData } = await supabase.auth.getUser();
    const currentUserId = authData.user?.id ?? null;

    let followingIds: string[] = [];
    if (currentUserId) {
      const { data: follows } = await supabase
        .from("aa_follows")
        .select("following_id")
        .eq("follower_id", currentUserId);
      followingIds = (follows ?? []).map((f: { following_id: string }) => f.following_id);
    }

    const buildActivityItems = (
      comments: { id: string; app_id: string; user_id: string; created_at: string }[],
      updates: { id: string; app_id: string; user_id: string; title: string; created_at: string }[],
      appNameMap: Record<string, string>,
      userNameMap: Record<string, string>,
    ): ActivityItem[] =>
      [
        ...comments.map((c) => ({
          key: `comment-${c.id}`,
          type: "comment" as const,
          text: `${userNameMap[c.user_id] ?? "ユーザー"} がコメント`,
          app_id: c.app_id,
          app_name: appNameMap[c.app_id] ?? "",
          created_at: c.created_at,
        })),
        ...updates.map((u) => ({
          key: `update-${u.id}`,
          type: "update" as const,
          text: `${userNameMap[u.user_id] ?? "開発者"} がアップデート`,
          app_id: u.app_id,
          app_name: appNameMap[u.app_id] ?? "",
          created_at: u.created_at,
        })),
      ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const resolveNames = async (
      comments: { app_id: string; user_id: string }[],
      updates: { app_id: string; user_id: string }[],
    ) => {
      const appIds = [...new Set([...comments.map((c) => c.app_id), ...updates.map((u) => u.app_id)])];
      const userIds = [...new Set([...comments.map((c) => c.user_id), ...updates.map((u) => u.user_id)])];
      const [appRes, userRes] = await Promise.all([
        appIds.length > 0 ? supabase.from("aa_apps").select("id, name").in("id", appIds) : Promise.resolve({ data: [] }),
        userIds.length > 0 ? supabase.from("aa_profiles").select("id, username").in("id", userIds) : Promise.resolve({ data: [] }),
      ]);
      const appNameMap: Record<string, string> = {};
      (appRes.data ?? []).forEach((a: { id: string; name: string }) => { appNameMap[a.id] = a.name; });
      const userNameMap: Record<string, string> = {};
      (userRes.data ?? []).forEach((p: { id: string; username: string }) => { userNameMap[p.id] = p.username; });
      return { appNameMap, userNameMap };
    };

    // Activity feed: フォロー中優先、足りなければ全体で補完
    let activityItems: ActivityItem[] = [];

    if (followingIds.length > 0) {
      const [followComments, followUpdates] = await Promise.all([
        supabase.from("aa_comments").select("id, app_id, user_id, created_at")
          .in("user_id", followingIds).order("created_at", { ascending: false }).limit(10),
        supabase.from("aa_app_updates").select("id, title, app_id, user_id, created_at")
          .in("user_id", followingIds).order("created_at", { ascending: false }).limit(5),
      ]);
      const fComments = followComments.data ?? [];
      const fUpdates = followUpdates.data ?? [];
      const { appNameMap, userNameMap } = await resolveNames(fComments, fUpdates);
      activityItems = buildActivityItems(fComments, fUpdates, appNameMap, userNameMap).slice(0, 8);
    }

    // フォロー中の結果が5件未満 or 未フォローなら全体フィードで補完
    if (activityItems.length < 5) {
      const [allComments, allUpdates] = await Promise.all([
        supabase.from("aa_comments").select("id, app_id, user_id, created_at")
          .order("created_at", { ascending: false }).limit(10),
        supabase.from("aa_app_updates").select("id, title, app_id, user_id, created_at")
          .order("created_at", { ascending: false }).limit(5),
      ]);
      const aC = allComments.data ?? [];
      const aU = allUpdates.data ?? [];
      const { appNameMap, userNameMap } = await resolveNames(aC, aU);
      const allItems = buildActivityItems(aC, aU, appNameMap, userNameMap);
      const existingKeys = new Set(activityItems.map((i) => i.key));
      const supplement = allItems.filter((i) => !existingKeys.has(i.key));
      activityItems = [...activityItems, ...supplement].slice(0, 8);
    }

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
      const nAppIds = newRes.map((a: App) => a.id);
      const [nProfilesRes, nCommentsRes] = await Promise.all([
        supabase.from("aa_profiles").select("id, username").in("id", nUserIds),
        supabase.from("aa_comments").select("app_id").in("app_id", nAppIds),
      ]);
      const nMap: Record<string, string> = {};
      nProfilesRes.data?.forEach((p: { id: string; username: string }) => { nMap[p.id] = p.username; });
      const nCommentMap: Record<string, number> = {};
      (nCommentsRes.data ?? []).forEach((c: { app_id: string }) => {
        nCommentMap[c.app_id] = (nCommentMap[c.app_id] ?? 0) + 1;
      });
      setNewApps(newRes.map((a: App) => ({
        ...a,
        username: nMap[a.user_id] ?? "anonymous",
        comment_count: nCommentMap[a.id] ?? 0,
      })));
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
    <View style={{ flex: 1 }}>
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
                      <View style={{ alignItems: "flex-end", gap: 2 }}>
                        <Text style={s.likeCount}>♥ {item.likes_count}</Text>
                        <Text style={s.commentCount}>💬 {item.comment_count ?? 0}</Text>
                      </View>
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
    {isDeveloper && (
      <TouchableOpacity style={s.fab} onPress={() => router.push("/(tabs)/submit")}>
        <Text style={s.fabText}>＋ 投稿</Text>
      </TouchableOpacity>
    )}
    </View>
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
  commentCount: { fontSize: 12, color: isDark ? "#71717a" : "#a1a1aa" },
  divider: { height: 1, backgroundColor: isDark ? "#27272a" : "#f2f2f7" },
  loadingText: { fontSize: 14, color: isDark ? "#71717a" : "#a1a1aa" },
  fab: {
    position: "absolute", bottom: 24, right: 20,
    backgroundColor: isDark ? "#ffffff" : "#09090b",
    borderRadius: 28, paddingHorizontal: 20, paddingVertical: 14,
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2, shadowRadius: 8, elevation: 6,
  },
  fabText: { fontSize: 15, fontWeight: "700", color: isDark ? "#09090b" : "#ffffff" },
});
