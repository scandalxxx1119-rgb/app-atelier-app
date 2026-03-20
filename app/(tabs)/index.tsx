import { useEffect, useState, useCallback } from "react";
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  StyleSheet, useColorScheme, RefreshControl, ScrollView, Image,
} from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";
import { PLATFORM_TAGS, CATEGORY_TAGS, SPECIAL_TAGS } from "@/lib/tags";
import Badge, { isPremiumBadge, BadgeType } from "@/components/Badge";
import type { User } from "@supabase/supabase-js";

type App = {
  id: string;
  name: string;
  tagline: string;
  icon_url: string | null;
  tags: string[] | null;
  likes_count: number;
  status: string | null;
  user_id: string;
  aa_profiles?: { username: string; badge: string | null } | null;
};

const SORT_OPTIONS = [
  { label: "新着", value: "created_at" },
  { label: "人気", value: "likes_count" },
];

export default function HomeScreen() {
  const isDark = useColorScheme() === "dark";
  const s = styles(isDark);
  const router = useRouter();

  const [apps, setApps] = useState<App[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [sort, setSort] = useState("created_at");
  const [tab, setTab] = useState<"all" | "mine">("all");
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    const { data: listener } = supabase.auth.onAuthStateChange((_e, session) =>
      setUser(session?.user ?? null)
    );
    return () => listener.subscription.unsubscribe();
  }, []);

  const fetchApps = useCallback(async () => {
    let query = supabase.from("aa_apps").select("*").order(sort, { ascending: false });
    if (tab === "mine" && user) query = query.eq("user_id", user.id);

    const { data } = await query;
    let appsData = (data as App[]) ?? [];

    const userIds = [...new Set(appsData.map((a) => a.user_id))];
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from("aa_profiles").select("id, username, badge").in("id", userIds);
      const map: Record<string, { username: string; badge: string | null }> = {};
      profiles?.forEach((p: { id: string; username: string; badge: string | null }) => {
        map[p.id] = { username: p.username, badge: p.badge };
      });
      appsData = appsData.map((a) => ({ ...a, aa_profiles: map[a.user_id] ?? null }));
    }

    let filtered = appsData;
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(
        (a) => a.name.toLowerCase().includes(q) || a.tagline.toLowerCase().includes(q)
      );
    }
    if (selectedTags.length > 0) {
      filtered = filtered.filter((a) => selectedTags.every((t) => a.tags?.includes(t)));
    }
    if (tab === "all") {
      filtered.sort((a, b) =>
        (isPremiumBadge(b.aa_profiles?.badge as BadgeType) ? 1 : 0) -
        (isPremiumBadge(a.aa_profiles?.badge as BadgeType) ? 1 : 0)
      );
    }
    setApps(filtered);
  }, [sort, search, selectedTags, tab, user]);

  useEffect(() => {
    setLoading(true);
    fetchApps().finally(() => setLoading(false));
  }, [fetchApps]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchApps();
    setRefreshing(false);
  };

  const toggleTag = (tag: string) =>
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );

  const statusBadge = (status: string | null) => {
    if (!status || status === "released")
      return <View style={[s.statusBadge, { backgroundColor: isDark ? "#14532d" : "#dcfce7" }]}><Text style={[s.statusText, { color: isDark ? "#86efac" : "#16a34a" }]}>✓ リリース済み</Text></View>;
    if (status === "beta")
      return <View style={[s.statusBadge, { backgroundColor: isDark ? "#1e3a5f" : "#dbeafe" }]}><Text style={[s.statusText, { color: isDark ? "#93c5fd" : "#2563eb" }]}>β ベータ版</Text></View>;
    return <View style={[s.statusBadge, { backgroundColor: isDark ? "#451a03" : "#fef3c7" }]}><Text style={[s.statusText, { color: isDark ? "#fcd34d" : "#d97706" }]}>🚧 開発中</Text></View>;
  };

  const renderApp = ({ item }: { item: App }) => (
    <TouchableOpacity style={s.card} onPress={() => router.push(`/apps/${item.id}`)}>
      <View style={s.cardHeader}>
        {item.icon_url ? (
          <Image source={{ uri: item.icon_url }} style={s.icon} />
        ) : (
          <View style={s.iconPlaceholder}>
            <Text style={s.iconText}>{item.name[0]}</Text>
          </View>
        )}
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={s.appName} numberOfLines={1}>{item.name}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 }}>
            <Text style={s.username} numberOfLines={1}>
              {item.aa_profiles?.username ?? "anonymous"}
            </Text>
            {item.aa_profiles?.badge && (
              <Badge badge={item.aa_profiles.badge as BadgeType} size="xs" />
            )}
          </View>
        </View>
        <View style={{ alignItems: "center" }}>
          <Text style={s.heartIcon}>♥</Text>
          <Text style={s.likesCount}>{item.likes_count}</Text>
        </View>
      </View>
      <Text style={s.tagline} numberOfLines={2}>{item.tagline}</Text>
      <View style={s.tagsRow}>
        {statusBadge(item.status)}
        {item.tags?.slice(0, 2).map((tag) => (
          <View key={tag} style={s.tag}>
            <Text style={s.tagText}>{tag}</Text>
          </View>
        ))}
        {item.tags && item.tags.length > 2 && (
          <View style={s.tag}><Text style={s.tagText}>+{item.tags.length - 2}</Text></View>
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={s.container}>
      {/* Search */}
      <View style={s.searchRow}>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="アプリを検索..."
          placeholderTextColor={isDark ? "#52525b" : "#a1a1aa"}
          style={s.searchInput}
        />
      </View>

      {/* Sort */}
      <View style={s.sortRow}>
        {SORT_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.value}
            onPress={() => setSort(opt.value)}
            style={[s.sortBtn, sort === opt.value && s.sortBtnActive]}
          >
            <Text style={[s.sortBtnText, sort === opt.value && s.sortBtnTextActive]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
        <View style={{ flex: 1 }} />
        {user && (
          <>
            <TouchableOpacity onPress={() => setTab("all")} style={[s.sortBtn, tab === "all" && s.sortBtnActive]}>
              <Text style={[s.sortBtnText, tab === "all" && s.sortBtnTextActive]}>すべて</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setTab("mine")} style={[s.sortBtn, tab === "mine" && s.sortBtnActive]}>
              <Text style={[s.sortBtnText, tab === "mine" && s.sortBtnTextActive]}>マイアプリ</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* Tag filters */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.tagScroll} contentContainerStyle={{ gap: 6, paddingHorizontal: 16 }}>
        {[...SPECIAL_TAGS, ...PLATFORM_TAGS, ...CATEGORY_TAGS].map((tag) => (
          <TouchableOpacity
            key={tag}
            onPress={() => toggleTag(tag)}
            style={[s.filterTag, selectedTags.includes(tag) && s.filterTagActive]}
          >
            <Text style={[s.filterTagText, selectedTags.includes(tag) && s.filterTagTextActive]}>
              {tag}
            </Text>
          </TouchableOpacity>
        ))}
        {selectedTags.length > 0 && (
          <TouchableOpacity onPress={() => setSelectedTags([])} style={s.clearBtn}>
            <Text style={s.clearBtnText}>クリア</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      <FlatList
        data={apps}
        keyExtractor={(item) => item.id}
        renderItem={renderApp}
        contentContainerStyle={{ padding: 16, gap: 12 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          loading ? null : (
            <View style={{ alignItems: "center", paddingTop: 60 }}>
              <Text style={s.emptyText}>
                {tab === "mine" ? "まだアプリを投稿していません" : "アプリが見つかりません"}
              </Text>
              <TouchableOpacity style={s.emptyBtn} onPress={() => router.push("/submit")}>
                <Text style={s.emptyBtnText}>アプリを投稿する</Text>
              </TouchableOpacity>
            </View>
          )
        }
      />
    </View>
  );
}

const styles = (isDark: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: isDark ? "#09090b" : "#f4f4f5" },
  searchRow: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  searchInput: {
    backgroundColor: isDark ? "#18181b" : "#ffffff",
    borderWidth: 1, borderColor: isDark ? "#3f3f46" : "#e4e4e7",
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 14, color: isDark ? "#ffffff" : "#09090b",
  },
  sortRow: { flexDirection: "row", paddingHorizontal: 16, paddingBottom: 8, gap: 8 },
  sortBtn: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8,
    borderWidth: 1, borderColor: isDark ? "#3f3f46" : "#e4e4e7",
  },
  sortBtnActive: { backgroundColor: isDark ? "#ffffff" : "#09090b", borderColor: "transparent" },
  sortBtnText: { fontSize: 13, fontWeight: "500", color: isDark ? "#a1a1aa" : "#71717a" },
  sortBtnTextActive: { color: isDark ? "#09090b" : "#ffffff" },
  tagScroll: { maxHeight: 44, marginBottom: 4 },
  filterTag: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 99,
    backgroundColor: isDark ? "#27272a" : "#f4f4f5", borderWidth: 1, borderColor: isDark ? "#3f3f46" : "#e4e4e7",
  },
  filterTagActive: { backgroundColor: isDark ? "#ffffff" : "#09090b", borderColor: "transparent" },
  filterTagText: { fontSize: 12, color: isDark ? "#a1a1aa" : "#71717a", fontWeight: "500" },
  filterTagTextActive: { color: isDark ? "#09090b" : "#ffffff" },
  clearBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 99, backgroundColor: "#ef4444" },
  clearBtnText: { fontSize: 12, color: "#ffffff", fontWeight: "500" },
  card: {
    backgroundColor: isDark ? "#18181b" : "#ffffff",
    borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: isDark ? "#27272a" : "#e4e4e7",
  },
  cardHeader: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  icon: { width: 52, height: 52, borderRadius: 12 },
  iconPlaceholder: {
    width: 52, height: 52, borderRadius: 12,
    backgroundColor: isDark ? "#27272a" : "#f4f4f5",
    alignItems: "center", justifyContent: "center",
  },
  iconText: { fontSize: 22, fontWeight: "700", color: isDark ? "#71717a" : "#a1a1aa" },
  appName: { fontSize: 16, fontWeight: "600", color: isDark ? "#ffffff" : "#09090b" },
  username: { fontSize: 12, color: isDark ? "#71717a" : "#a1a1aa", maxWidth: 100 },
  heartIcon: { fontSize: 16, color: "#ef4444" },
  likesCount: { fontSize: 12, color: isDark ? "#71717a" : "#a1a1aa" },
  tagline: { fontSize: 13, color: isDark ? "#a1a1aa" : "#71717a", marginBottom: 10 },
  tagsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99 },
  statusText: { fontSize: 11, fontWeight: "600" },
  tag: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99,
    backgroundColor: isDark ? "#27272a" : "#f4f4f5",
  },
  tagText: { fontSize: 11, color: isDark ? "#a1a1aa" : "#71717a" },
  emptyText: { fontSize: 14, color: isDark ? "#71717a" : "#a1a1aa", marginBottom: 16 },
  emptyBtn: { backgroundColor: isDark ? "#ffffff" : "#09090b", paddingHorizontal: 20, paddingVertical: 10, borderRadius: 99 },
  emptyBtnText: { color: isDark ? "#09090b" : "#ffffff", fontWeight: "600", fontSize: 14 },
});
