import { useEffect, useState, useCallback } from "react";
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  StyleSheet, Image, ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";
import { CATEGORY_TAGS } from "@/lib/tags";
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

export default function SearchScreen() {
  const { isDark } = useTheme();
  const s = styles(isDark);
  const router = useRouter();

  const [query, setQuery] = useState("");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [results, setResults] = useState<App[]>([]);
  const [loading, setLoading] = useState(false);

  const search = useCallback(async () => {
    if (!query.trim() && !selectedTag) {
      setResults([]);
      return;
    }
    setLoading(true);
    let q = supabase
      .from("aa_apps")
      .select("id, name, tagline, icon_url, tags, likes_count, status, user_id")
      .order("likes_count", { ascending: false })
      .limit(30);

    if (query.trim()) {
      q = q.or(`name.ilike.%${query.trim()}%,tagline.ilike.%${query.trim()}%`);
    }
    if (selectedTag) {
      q = q.contains("tags", [selectedTag]);
    }

    const { data } = await q;
    const apps = (data as App[]) ?? [];
    const userIds = [...new Set(apps.map((a) => a.user_id))];
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from("aa_profiles").select("id, username").in("id", userIds);
      const map: Record<string, string> = {};
      profiles?.forEach((p: { id: string; username: string }) => { map[p.id] = p.username; });
      setResults(apps.map((a) => ({ ...a, username: map[a.user_id] ?? "anonymous" })));
    } else {
      setResults(apps);
    }
    setLoading(false);
  }, [query, selectedTag]);

  useEffect(() => {
    const timer = setTimeout(search, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const renderItem = ({ item }: { item: App }) => (
    <TouchableOpacity style={s.card} onPress={() => router.push(`/apps/${item.id}`)}>
      {item.icon_url ? (
        <Image source={{ uri: item.icon_url }} style={s.icon} />
      ) : (
        <View style={s.iconPlaceholder}>
          <Text style={s.iconInitial}>{item.name[0]}</Text>
        </View>
      )}
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={s.appName} numberOfLines={1}>{item.name}</Text>
        <Text style={s.appTagline} numberOfLines={2}>{item.tagline}</Text>
        <Text style={s.username}>{item.username} · ♥ {item.likes_count}</Text>
      </View>
    </TouchableOpacity>
  );

  const showEmpty = !query.trim() && !selectedTag;

  return (
    <View style={s.container}>
      {/* Search input */}
      <View style={s.searchRow}>
        <TextInput
          style={s.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder="アプリ名・説明で検索"
          placeholderTextColor={isDark ? "#52525b" : "#a1a1aa"}
          returnKeyType="search"
          clearButtonMode="while-editing"
          autoCorrect={false}
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery("")} style={s.clearBtn}>
            <Text style={s.clearBtnText}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Category chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chipScroll} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}>
        {CATEGORY_TAGS.map((tag) => (
          <TouchableOpacity
            key={tag}
            style={[s.chip, selectedTag === tag && s.chipActive]}
            onPress={() => setSelectedTag(selectedTag === tag ? null : tag)}
          >
            <Text style={[s.chipText, selectedTag === tag && s.chipTextActive]}>{tag}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {showEmpty ? (
        <View style={{ alignItems: "center", paddingTop: 80 }}>
          <Text style={s.hintText}>キーワードやカテゴリで絞り込もう</Text>
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingVertical: 8 }}
          ItemSeparatorComponent={() => <View style={s.separator} />}
          ListEmptyComponent={
            !loading ? (
              <View style={{ alignItems: "center", paddingTop: 60 }}>
                <Text style={s.hintText}>見つかりませんでした</Text>
              </View>
            ) : null
          }
        />
      )}
    </View>
  );
}

const styles = (isDark: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: isDark ? "#09090b" : "#f2f2f7" },
  searchRow: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 10,
    backgroundColor: isDark ? "#18181b" : "#ffffff",
    borderBottomWidth: 1, borderBottomColor: isDark ? "#27272a" : "#e4e4e7",
    gap: 8,
  },
  searchInput: {
    flex: 1, backgroundColor: isDark ? "#09090b" : "#f4f4f5",
    borderWidth: 1, borderColor: isDark ? "#3f3f46" : "#e4e4e7",
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 16, color: isDark ? "#ffffff" : "#09090b",
  },
  clearBtn: { padding: 6 },
  clearBtnText: { fontSize: 16, color: isDark ? "#71717a" : "#a1a1aa" },
  chipScroll: { maxHeight: 44, paddingVertical: 6, backgroundColor: isDark ? "#18181b" : "#ffffff", borderBottomWidth: 1, borderBottomColor: isDark ? "#27272a" : "#e4e4e7" },
  chip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 99, backgroundColor: isDark ? "#27272a" : "#f4f4f5", borderWidth: 1, borderColor: isDark ? "#3f3f46" : "#e4e4e7" },
  chipActive: { backgroundColor: isDark ? "#ffffff" : "#09090b", borderColor: "transparent" },
  chipText: { fontSize: 13, fontWeight: "500", color: isDark ? "#a1a1aa" : "#71717a" },
  chipTextActive: { color: isDark ? "#09090b" : "#ffffff" },
  card: { flexDirection: "row", alignItems: "center", paddingVertical: 12, paddingHorizontal: 16, backgroundColor: isDark ? "#18181b" : "#ffffff" },
  icon: { width: 56, height: 56, borderRadius: 12 },
  iconPlaceholder: { width: 56, height: 56, borderRadius: 12, backgroundColor: isDark ? "#27272a" : "#f4f4f5", alignItems: "center", justifyContent: "center" },
  iconInitial: { fontSize: 22, fontWeight: "700", color: isDark ? "#71717a" : "#a1a1aa" },
  appName: { fontSize: 15, fontWeight: "600", color: isDark ? "#ffffff" : "#09090b" },
  appTagline: { fontSize: 12, color: isDark ? "#71717a" : "#a1a1aa", marginTop: 2 },
  username: { fontSize: 11, color: isDark ? "#52525b" : "#a1a1aa", marginTop: 4 },
  separator: { height: 1, backgroundColor: isDark ? "#27272a" : "#f2f2f7", marginLeft: 16 + 56 + 12 },
  hintText: { fontSize: 14, color: isDark ? "#71717a" : "#a1a1aa" },
});
