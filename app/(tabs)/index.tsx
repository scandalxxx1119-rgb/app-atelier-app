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
};

type FeaturedApp = App & { username: string };

export default function HomeScreen() {
  const { isDark } = useTheme();
  const s = styles(isDark);
  const router = useRouter();

  const [featured, setFeatured] = useState<FeaturedApp[]>([]);
  const [newApps, setNewApps] = useState<App[]>([]);
  const [popularApps, setPopularApps] = useState<App[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    const now = new Date().toISOString();

    // Fetch active boosts for featured section
    const { data: boosts } = await supabase
      .from("aa_boosts")
      .select("app_id")
      .gt("expires_at", now)
      .order("created_at", { ascending: false });

    const boostedAppIds = [...new Set((boosts ?? []).map((b: { app_id: string }) => b.app_id))];

    let featuredApps: FeaturedApp[] = [];
    if (boostedAppIds.length > 0) {
      const { data: fApps } = await supabase
        .from("aa_apps")
        .select("id, name, tagline, icon_url, tags, likes_count, status, user_id")
        .in("id", boostedAppIds)
        .limit(20);

      if (fApps && fApps.length > 0) {
        const userIds = [...new Set(fApps.map((a: App) => a.user_id))];
        const { data: profiles } = await supabase
          .from("aa_profiles").select("id, username").in("id", userIds);
        const profileMap: Record<string, string> = {};
        profiles?.forEach((p: { id: string; username: string }) => {
          profileMap[p.id] = p.username;
        });
        featuredApps = fApps.map((a: App) => ({ ...a, username: profileMap[a.user_id] ?? "anonymous" }));
      }
    }
    setFeatured(featuredApps);

    // Fetch new apps + popular apps in parallel
    const [newRes, popularRes] = await Promise.all([
      supabase.from("aa_apps")
        .select("id, name, tagline, icon_url, tags, likes_count, status, user_id")
        .order("created_at", { ascending: false })
        .limit(20),
      supabase.from("aa_apps")
        .select("id, name, tagline, icon_url, tags, likes_count, status, user_id")
        .order("likes_count", { ascending: false })
        .limit(10),
    ]);

    const allApps = [...(newRes.data ?? []), ...(popularRes.data ?? [])];
    const allUserIds = [...new Set(allApps.map((a: App) => a.user_id))];
    let profileMap2: Record<string, string> = {};
    if (allUserIds.length > 0) {
      const { data: profiles2 } = await supabase
        .from("aa_profiles").select("id, username").in("id", allUserIds);
      profiles2?.forEach((p: { id: string; username: string }) => {
        profileMap2[p.id] = p.username;
      });
    }

    setNewApps((newRes.data ?? []).map((a: App) => ({ ...a, username: profileMap2[a.user_id] ?? "anonymous" })));
    setPopularApps((popularRes.data ?? []).map((a: App) => ({ ...a, username: profileMap2[a.user_id] ?? "anonymous" })));
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

  const AppIcon = ({ item, size = 60 }: { item: App; size?: number }) => (
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

  const renderFeaturedCard = (item: FeaturedApp) => (
    <TouchableOpacity key={item.id} style={s.featuredCard} onPress={() => router.push(`/apps/${item.id}`)}>
      <AppIcon item={item} size={80} />
      <Text style={s.featuredName} numberOfLines={1}>{item.name}</Text>
      <Text style={s.featuredUser} numberOfLines={1}>by {item.username}</Text>
      <Text style={s.featuredLike}>♥ {item.likes_count}</Text>
    </TouchableOpacity>
  );

  const renderRow = ({ item }: { item: App }) => (
    <TouchableOpacity style={s.rowCard} onPress={() => router.push(`/apps/${item.id}`)}>
      <AppIcon item={item} size={56} />
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={s.rowName} numberOfLines={1}>{item.name}</Text>
        <Text style={s.rowTagline} numberOfLines={1}>{item.tagline}</Text>
        <Text style={s.rowUser} numberOfLines={1}>by {(item as App & { username?: string }).username}</Text>
      </View>
      <View style={{ alignItems: "center", gap: 4 }}>
        <Text style={s.likeCount}>♥ {item.likes_count}</Text>
      </View>
    </TouchableOpacity>
  );

  const SectionHeader = ({ title, subtitle }: { title: string; subtitle?: string }) => (
    <View style={s.sectionHeader}>
      <View>
        <Text style={s.sectionTitle}>{title}</Text>
        {subtitle && <Text style={s.sectionSubtitle}>{subtitle}</Text>}
      </View>
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
          {/* Featured / Boosted */}
          {featured.length > 0 && (
            <View style={s.section}>
              <SectionHeader title="注目プロジェクト" subtitle="開発者がプッシュ中" />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 16, paddingBottom: 4 }}>
                {featured.map(renderFeaturedCard)}
              </ScrollView>
            </View>
          )}

          {/* New Arrivals */}
          {newApps.length > 0 && (
            <View style={s.section}>
              <SectionHeader title="最新の投稿" subtitle="開発者が公開した作品" />
              <View style={{ paddingHorizontal: 16 }}>
                {newApps.slice(0, 5).map((item, index) => (
                  <View key={item.id}>
                    {renderRow({ item })}
                    {index < Math.min(newApps.length, 5) - 1 && <Divider />}
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Popular Apps */}
          {popularApps.length > 0 && (
            <View style={[s.section, { marginBottom: 32 }]}>
              <SectionHeader title="みんなが応援中" subtitle="いいねが多い作品" />
              <View style={{ paddingHorizontal: 16 }}>
                {popularApps.slice(0, 5).map((item, index) => (
                  <View key={item.id}>
                    {renderRow({ item })}
                    {index < Math.min(popularApps.length, 5) - 1 && <Divider />}
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
    marginHorizontal: 16, marginTop: 20,
    borderRadius: 16, overflow: "hidden",
    borderWidth: 1, borderColor: isDark ? "#27272a" : "#e4e4e7",
  },
  sectionHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end",
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: isDark ? "#27272a" : "#f2f2f7",
  },
  sectionTitle: { fontSize: 17, fontWeight: "700", color: isDark ? "#ffffff" : "#09090b" },
  sectionSubtitle: { fontSize: 12, color: isDark ? "#71717a" : "#a1a1aa", marginTop: 2 },
  featuredCard: {
    width: 120, alignItems: "center", paddingVertical: 12,
  },
  featuredName: { fontSize: 12, fontWeight: "600", color: isDark ? "#ffffff" : "#09090b", marginTop: 8, textAlign: "center" },
  featuredUser: { fontSize: 11, color: isDark ? "#71717a" : "#a1a1aa", marginTop: 2, textAlign: "center" },
  featuredLike: { fontSize: 11, color: "#ef4444", marginTop: 6, textAlign: "center" },
  iconPlaceholder: {
    backgroundColor: isDark ? "#27272a" : "#f4f4f5",
    alignItems: "center", justifyContent: "center",
  },
  rowCard: { flexDirection: "row", alignItems: "center", paddingVertical: 12 },
  rowName: { fontSize: 15, fontWeight: "600", color: isDark ? "#ffffff" : "#09090b" },
  rowTagline: { fontSize: 12, color: isDark ? "#71717a" : "#a1a1aa", marginTop: 2 },
  rowUser: { fontSize: 11, color: isDark ? "#52525b" : "#a1a1aa", marginTop: 2 },
  likeCount: { fontSize: 11, color: isDark ? "#71717a" : "#a1a1aa" },
  divider: { height: 1, backgroundColor: isDark ? "#27272a" : "#f2f2f7" },
  loadingText: { fontSize: 14, color: isDark ? "#71717a" : "#a1a1aa" },
});
