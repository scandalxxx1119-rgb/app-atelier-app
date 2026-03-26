import { useEffect, useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Image, ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useTheme } from "@/lib/theme";
import Badge, { BadgeType } from "@/components/Badge";

type RankedDeveloper = {
  id: string;
  username: string;
  avatar_url: string | null;
  badge: string | null;
  value: number;
};

const MEDAL = ["🥇", "🥈", "🥉"];

export default function DeveloperRankingScreen() {
  const { isDark } = useTheme();
  const s = styles(isDark);
  const router = useRouter();

  const [byApps, setByApps] = useState<RankedDeveloper[]>([]);
  const [byLikes, setByLikes] = useState<RankedDeveloper[]>([]);
  const [byUpdates, setByUpdates] = useState<RankedDeveloper[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      // 作品数ランキング
      const { data: apps } = await supabase
        .from("aa_apps")
        .select("user_id");

      // いいね数ランキング
      const { data: appsWithLikes } = await supabase
        .from("aa_apps")
        .select("user_id, likes_count");

      // 更新頻度ランキング（直近30日のaa_app_updates）
      const since = new Date();
      since.setDate(since.getDate() - 30);
      const { data: updates } = await supabase
        .from("aa_app_updates")
        .select("user_id")
        .gte("created_at", since.toISOString());

      // 集計
      const appCountMap: Record<string, number> = {};
      (apps ?? []).forEach((a: { user_id: string }) => {
        appCountMap[a.user_id] = (appCountMap[a.user_id] ?? 0) + 1;
      });

      const likesMap: Record<string, number> = {};
      (appsWithLikes ?? []).forEach((a: { user_id: string; likes_count: number }) => {
        likesMap[a.user_id] = (likesMap[a.user_id] ?? 0) + a.likes_count;
      });

      const updateMap: Record<string, number> = {};
      (updates ?? []).forEach((u: { user_id: string }) => {
        updateMap[u.user_id] = (updateMap[u.user_id] ?? 0) + 1;
      });

      // 上位3人のユーザーID取得
      const top3 = (map: Record<string, number>) =>
        Object.entries(map)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([id, value]) => ({ id, value }));

      const topAppIds = top3(appCountMap);
      const topLikeIds = top3(likesMap);
      const topUpdateIds = top3(updateMap);

      const allIds = [...new Set([
        ...topAppIds.map(x => x.id),
        ...topLikeIds.map(x => x.id),
        ...topUpdateIds.map(x => x.id),
      ])];

      if (allIds.length === 0) { setLoading(false); return; }

      const { data: profiles } = await supabase
        .from("aa_profiles")
        .select("id, username, avatar_url, badge")
        .in("id", allIds);

      const profileMap: Record<string, { username: string; avatar_url: string | null; badge: string | null }> = {};
      (profiles ?? []).forEach((p: { id: string; username: string; avatar_url: string | null; badge: string | null }) => {
        profileMap[p.id] = { username: p.username, avatar_url: p.avatar_url, badge: p.badge };
      });

      const toRanked = (list: { id: string; value: number }[]): RankedDeveloper[] =>
        list.map(({ id, value }) => ({
          id,
          value,
          username: profileMap[id]?.username ?? "anonymous",
          avatar_url: profileMap[id]?.avatar_url ?? null,
          badge: profileMap[id]?.badge ?? null,
        }));

      setByApps(toRanked(topAppIds));
      setByLikes(toRanked(topLikeIds));
      setByUpdates(toRanked(topUpdateIds));
      setLoading(false);
    };

    fetch();
  }, []);

  const DevCard = ({ dev, rank, valueLabel }: { dev: RankedDeveloper; rank: number; valueLabel: string }) => (
    <TouchableOpacity style={s.devCard} onPress={() => router.push(`/users/${dev.username}`)}>
      <Text style={s.medal}>{MEDAL[rank]}</Text>
      {dev.avatar_url ? (
        <Image source={{ uri: dev.avatar_url }} style={s.avatar} />
      ) : (
        <View style={s.avatarPlaceholder}>
          <Text style={s.avatarInitial}>{dev.username[0].toUpperCase()}</Text>
        </View>
      )}
      <View style={{ flex: 1, marginLeft: 10 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Text style={s.username} numberOfLines={1}>{dev.username}</Text>
          {dev.badge && <Badge badge={dev.badge as BadgeType} size="xs" />}
        </View>
        <Text style={s.valueText}>{valueLabel}</Text>
      </View>
    </TouchableOpacity>
  );

  const Section = ({ title, data, valueLabel }: { title: string; data: RankedDeveloper[]; valueLabel: (v: number) => string }) => (
    <View style={s.section}>
      <Text style={s.sectionTitle}>{title}</Text>
      {data.length === 0 ? (
        <Text style={s.emptyText}>データがありません</Text>
      ) : (
        data.map((dev, i) => (
          <DevCard key={dev.id} dev={dev} rank={i} valueLabel={valueLabel(dev.value)} />
        ))
      )}
    </View>
  );

  if (loading) return <ActivityIndicator style={{ flex: 1 }} />;

  return (
    <ScrollView style={s.container} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <Text style={s.header}>今月の開発者ランキング</Text>
      <Text style={s.subheader}>頑張っている開発者を応援しよう</Text>

      <Section
        title="📦 作品数"
        data={byApps}
        valueLabel={(v) => `${v}作品`}
      />
      <Section
        title="♥ いいね数"
        data={byLikes}
        valueLabel={(v) => `${v}いいね`}
      />
      <Section
        title="🔄 更新頻度（直近30日）"
        data={byUpdates}
        valueLabel={(v) => `${v}回更新`}
      />
    </ScrollView>
  );
}

const styles = (isDark: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: isDark ? "#09090b" : "#f2f2f7" },
  header: { fontSize: 22, fontWeight: "700", color: isDark ? "#ffffff" : "#09090b", marginBottom: 4 },
  subheader: { fontSize: 13, color: isDark ? "#71717a" : "#a1a1aa", marginBottom: 20 },
  section: {
    backgroundColor: isDark ? "#18181b" : "#ffffff",
    borderRadius: 16, borderWidth: 1,
    borderColor: isDark ? "#27272a" : "#e4e4e7",
    marginBottom: 16, overflow: "hidden",
  },
  sectionTitle: {
    fontSize: 15, fontWeight: "700",
    color: isDark ? "#ffffff" : "#09090b",
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: isDark ? "#27272a" : "#f2f2f7",
  },
  devCard: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: isDark ? "#27272a" : "#f2f2f7",
  },
  medal: { fontSize: 22, width: 32, textAlign: "center" },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  avatarPlaceholder: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: isDark ? "#27272a" : "#e4e4e7",
    alignItems: "center", justifyContent: "center",
  },
  avatarInitial: { fontSize: 18, fontWeight: "700", color: isDark ? "#71717a" : "#a1a1aa" },
  username: { fontSize: 14, fontWeight: "600", color: isDark ? "#ffffff" : "#09090b" },
  valueText: { fontSize: 12, color: isDark ? "#71717a" : "#a1a1aa", marginTop: 2 },
  emptyText: { fontSize: 13, color: isDark ? "#52525b" : "#a1a1aa", padding: 16 },
});
