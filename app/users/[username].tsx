import { useEffect, useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
   Image, ActivityIndicator, Linking,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useTheme } from "@/lib/theme";
import Badge, { BadgeType } from "@/components/Badge";

type Profile = {
  id: string; username: string; badge: string | null;
  bio: string | null; twitter_url: string | null;
  github_url: string | null; website_url: string | null; avatar_url: string | null;
};
type App = {
  id: string; name: string; tagline: string;
  icon_url: string | null; likes_count: number; status: string | null;
};

export default function UserProfileScreen() {
  const { username } = useLocalSearchParams<{ username: string }>();
  const { isDark } = useTheme();
  const s = styles(isDark);
  const router = useRouter();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [apps, setApps] = useState<App[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from("aa_profiles")
      .select("id, username, badge, bio, twitter_url, github_url, website_url, avatar_url")
      .eq("username", decodeURIComponent(username as string)).single()
      .then(async ({ data }) => {
        if (!data) { setLoading(false); return; }
        setProfile(data as Profile);
        const { data: appsData } = await supabase.from("aa_apps")
          .select("id, name, tagline, icon_url, likes_count, status")
          .eq("user_id", data.id).order("created_at", { ascending: false });
        setApps((appsData as App[]) ?? []);
        setLoading(false);
      });
  }, [username]);

  if (loading) return <ActivityIndicator style={{ flex: 1 }} />;
  if (!profile) return (
    <View style={[s.container, { alignItems: "center", justifyContent: "center" }]}>
      <Text style={{ color: isDark ? "#71717a" : "#a1a1aa" }}>ユーザーが見つかりません</Text>
    </View>
  );

  const statusColor = (status: string | null) =>
    !status || status === "released"
      ? { bg: isDark ? "#14532d" : "#dcfce7", text: isDark ? "#86efac" : "#16a34a", label: "✓ リリース済み" }
      : status === "beta"
      ? { bg: isDark ? "#1e3a5f" : "#dbeafe", text: isDark ? "#93c5fd" : "#2563eb", label: "β ベータ版" }
      : { bg: isDark ? "#451a03" : "#fef3c7", text: isDark ? "#fcd34d" : "#d97706", label: "🚧 開発中" };

  return (
    <ScrollView style={s.container} contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>
      {/* Profile header */}
      <View style={s.profileHeader}>
        {profile.avatar_url ? (
          <Image source={{ uri: profile.avatar_url }} style={s.avatar} />
        ) : (
          <View style={s.avatarPlaceholder}>
            <Text style={s.avatarInitial}>{profile.username[0].toUpperCase()}</Text>
          </View>
        )}
        <View style={{ flex: 1, marginLeft: 16 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
            <Text style={s.username}>{profile.username}</Text>
            {profile.badge && <Badge badge={profile.badge as BadgeType} />}
          </View>
          {profile.bio && <Text style={s.bio}>{profile.bio}</Text>}
          <Text style={s.appCount}>{apps.length}個のアプリ</Text>
        </View>
      </View>

      {/* External links */}
      {(profile.twitter_url || profile.github_url || profile.website_url) && (
        <View style={s.linksRow}>
          {profile.twitter_url && (
            <TouchableOpacity style={s.linkBtn} onPress={() => Linking.openURL(profile.twitter_url!)}>
              <Text style={s.linkBtnIcon}>𝕏</Text>
              <Text style={s.linkBtnText}>Twitter</Text>
            </TouchableOpacity>
          )}
          {profile.github_url && (
            <TouchableOpacity style={s.linkBtn} onPress={() => Linking.openURL(profile.github_url!)}>
              <Text style={s.linkBtnIcon}>🐙</Text>
              <Text style={s.linkBtnText}>GitHub</Text>
            </TouchableOpacity>
          )}
          {profile.website_url && (
            <TouchableOpacity style={s.linkBtn} onPress={() => Linking.openURL(profile.website_url!)}>
              <Text style={s.linkBtnIcon}>🌐</Text>
              <Text style={s.linkBtnText}>Website</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Apps list */}
      <View style={{ gap: 12 }}>
        {apps.map((app) => {
          const sc = statusColor(app.status);
          return (
            <TouchableOpacity key={app.id} style={s.appCard} onPress={() => router.push(`/apps/${app.id}`)}>
              {app.icon_url ? (
                <Image source={{ uri: app.icon_url }} style={s.appIcon} />
              ) : (
                <View style={s.appIconPlaceholder}>
                  <Text style={{ fontSize: 18, fontWeight: "700", color: isDark ? "#71717a" : "#a1a1aa" }}>{app.name[0]}</Text>
                </View>
              )}
              <View style={{ flex: 1, marginLeft: 14 }}>
                <Text style={s.appName} numberOfLines={1}>{app.name}</Text>
                <Text style={s.appTagline} numberOfLines={1}>{app.tagline}</Text>
                <View style={[s.statusBadge, { backgroundColor: sc.bg, alignSelf: "flex-start", marginTop: 4 }]}>
                  <Text style={[s.statusText, { color: sc.text }]}>{sc.label}</Text>
                </View>
              </View>
              <View style={{ alignItems: "center" }}>
                <Text style={{ fontSize: 14, color: "#ef4444" }}>♥</Text>
                <Text style={s.likesCount}>{app.likes_count}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = (isDark: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: isDark ? "#09090b" : "#f4f4f5" },
  profileHeader: { flexDirection: "row", alignItems: "flex-start", marginBottom: 24 },
  avatar: { width: 72, height: 72, borderRadius: 36 },
  avatarPlaceholder: { width: 72, height: 72, borderRadius: 36, backgroundColor: isDark ? "#27272a" : "#e4e4e7", alignItems: "center", justifyContent: "center" },
  avatarInitial: { fontSize: 28, fontWeight: "700", color: isDark ? "#71717a" : "#a1a1aa" },
  username: { fontSize: 20, fontWeight: "700", color: isDark ? "#ffffff" : "#09090b" },
  bio: { fontSize: 13, color: isDark ? "#a1a1aa" : "#71717a", marginBottom: 8 },
  appCount: { fontSize: 12, color: isDark ? "#71717a" : "#a1a1aa", marginTop: 4 },
  linksRow: { flexDirection: "row", gap: 10, marginBottom: 20, flexWrap: "wrap" },
  linkBtn: {
    flex: 1, minWidth: 90, alignItems: "center", justifyContent: "center",
    paddingVertical: 14, borderRadius: 14,
    backgroundColor: isDark ? "#18181b" : "#ffffff",
    borderWidth: 1, borderColor: isDark ? "#27272a" : "#e4e4e7",
    gap: 4,
  },
  linkBtnIcon: { fontSize: 26, color: isDark ? "#ffffff" : "#09090b" },
  linkBtnText: { fontSize: 12, fontWeight: "600", color: isDark ? "#a1a1aa" : "#71717a" },
  appCard: { flexDirection: "row", alignItems: "center", backgroundColor: isDark ? "#18181b" : "#ffffff", borderRadius: 14, padding: 14, borderWidth: 1, borderColor: isDark ? "#27272a" : "#e4e4e7" },
  appIcon: { width: 48, height: 48, borderRadius: 10 },
  appIconPlaceholder: { width: 48, height: 48, borderRadius: 10, backgroundColor: isDark ? "#27272a" : "#f4f4f5", alignItems: "center", justifyContent: "center" },
  appName: { fontSize: 15, fontWeight: "600", color: isDark ? "#ffffff" : "#09090b" },
  appTagline: { fontSize: 12, color: isDark ? "#71717a" : "#a1a1aa", marginTop: 2 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 99 },
  statusText: { fontSize: 10, fontWeight: "600" },
  likesCount: { fontSize: 11, color: isDark ? "#71717a" : "#a1a1aa" },
});
