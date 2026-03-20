import { useEffect, useState, useCallback } from "react";
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, useColorScheme, Image, Alert, ActivityIndicator,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";
import Badge, { BadgeType } from "@/components/Badge";
import type { User } from "@supabase/supabase-js";

type App = {
  id: string;
  name: string;
  tagline: string;
  icon_url: string | null;
  likes_count: number;
  status: string | null;
};

export default function ProfileScreen() {
  const isDark = useColorScheme() === "dark";
  const s = styles(isDark);
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [username, setUsername] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [bio, setBio] = useState("");
  const [twitterUrl, setTwitterUrl] = useState("");
  const [githubUrl, setGithubUrl] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [badge, setBadge] = useState<BadgeType>(null);
  const [usernameUpdatedAt, setUsernameUpdatedAt] = useState<string | null>(null);
  const [apps, setApps] = useState<App[]>([]);
  const [points, setPoints] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const canChangeUsername = () => {
    if (!usernameUpdatedAt) return true;
    const days = (Date.now() - new Date(usernameUpdatedAt).getTime()) / (1000 * 60 * 60 * 24);
    return days >= 7;
  };
  const daysUntilChange = () => {
    if (!usernameUpdatedAt) return 0;
    const days = (Date.now() - new Date(usernameUpdatedAt).getTime()) / (1000 * 60 * 60 * 24);
    return Math.ceil(7 - days);
  };

  const load = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) { router.replace("/auth"); return; }
    setUser(auth.user);

    const [profileRes, appsRes, pointsRes] = await Promise.all([
      supabase.from("aa_profiles")
        .select("username, badge, username_updated_at, bio, twitter_url, github_url, website_url, avatar_url")
        .eq("id", auth.user.id).single(),
      supabase.from("aa_apps")
        .select("id, name, tagline, icon_url, likes_count, status")
        .eq("user_id", auth.user.id).order("created_at", { ascending: false }),
      supabase.from("aa_points").select("amount").eq("user_id", auth.user.id),
    ]);

    setUsername(profileRes.data?.username ?? "");
    setAvatarUrl(profileRes.data?.avatar_url ?? null);
    setBadge(profileRes.data?.badge ?? null);
    setUsernameUpdatedAt(profileRes.data?.username_updated_at ?? null);
    setBio(profileRes.data?.bio ?? "");
    setTwitterUrl(profileRes.data?.twitter_url ?? "");
    setGithubUrl(profileRes.data?.github_url ?? "");
    setWebsiteUrl(profileRes.data?.website_url ?? "");
    setApps((appsRes.data as App[]) ?? []);
    const total = (pointsRes.data ?? []).reduce((sum: number, r: { amount: number }) => sum + r.amount, 0);
    setPoints(total);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAvatarChange = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, aspect: [1, 1], quality: 0.8,
    });
    if (result.canceled || !user) return;
    const uri = result.assets[0].uri;
    const response = await fetch(uri);
    const blob = await response.blob();
    const path = `${user.id}/avatar.jpg`;
    const { error } = await supabase.storage.from("aa-apps").upload(path, blob, {
      contentType: "image/jpeg", upsert: true,
    });
    if (!error) {
      const { data } = supabase.storage.from("aa-apps").getPublicUrl(path);
      setAvatarUrl(data.publicUrl);
      await supabase.from("aa_profiles").upsert({ id: user.id, avatar_url: data.publicUrl });
    }
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const now = new Date().toISOString();
    await supabase.from("aa_profiles").upsert({
      id: user.id,
      username: username.trim() || undefined,
      username_updated_at: canChangeUsername() ? now : usernameUpdatedAt,
      bio: bio.trim() || null,
      twitter_url: twitterUrl.trim() || null,
      github_url: githubUrl.trim() || null,
      website_url: websiteUrl.trim() || null,
    });
    if (canChangeUsername() && username.trim()) setUsernameUpdatedAt(now);
    setSaving(false);
    Alert.alert("保存完了", "プロフィールを更新しました");
  };

  const handleDelete = (appId: string) => {
    Alert.alert("削除確認", "このアプリを削除しますか？", [
      { text: "キャンセル", style: "cancel" },
      {
        text: "削除", style: "destructive",
        onPress: async () => {
          await supabase.from("aa_apps").delete().eq("id", appId);
          setApps((prev) => prev.filter((a) => a.id !== appId));
        },
      },
    ]);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.replace("/auth");
  };

  if (loading) return <View style={s.container}><ActivityIndicator style={{ marginTop: 60 }} /></View>;

  return (
    <ScrollView style={s.container} contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>
      {/* Avatar */}
      <View style={s.avatarRow}>
        <TouchableOpacity onPress={handleAvatarChange}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={s.avatar} />
          ) : (
            <View style={s.avatarPlaceholder}>
              <Text style={s.avatarInitial}>{username ? username[0].toUpperCase() : "?"}</Text>
            </View>
          )}
          <View style={s.avatarEdit}><Text style={{ color: "#fff", fontSize: 10 }}>✏️</Text></View>
        </TouchableOpacity>
        <View style={{ marginLeft: 16, flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <Text style={s.usernameText}>{username || "未設定"}</Text>
            {badge && <Badge badge={badge} />}
          </View>
          <Text style={s.emailText}>{user?.email}</Text>
          <View style={s.pointsBadge}>
            <Text style={s.pointsText}>🪙 {points} pt</Text>
          </View>
        </View>
      </View>

      {/* Profile fields */}
      <View style={s.section}>
        <Text style={s.sectionTitle}>プロフィール</Text>
        {username && (
          <TouchableOpacity onPress={() => router.push(`/users/${username}`)} style={s.publicLink}>
            <Text style={s.publicLinkText}>公開ページを見る →</Text>
          </TouchableOpacity>
        )}

        <Text style={s.label}>ユーザー名</Text>
        <TextInput
          style={[s.input, !canChangeUsername() && { opacity: 0.5 }]}
          value={username}
          onChangeText={setUsername}
          editable={canChangeUsername()}
          maxLength={30}
          autoCapitalize="none"
        />
        {!canChangeUsername() && (
          <Text style={s.hint}>あと{daysUntilChange()}日後に変更できます</Text>
        )}

        <Text style={s.label}>自己紹介</Text>
        <TextInput
          style={[s.input, { height: 80, textAlignVertical: "top" }]}
          value={bio}
          onChangeText={setBio}
          multiline
          maxLength={200}
          placeholder="個人開発者です..."
          placeholderTextColor={isDark ? "#52525b" : "#a1a1aa"}
        />

        <Text style={s.label}>𝕏 Twitter</Text>
        <TextInput style={s.input} value={twitterUrl} onChangeText={setTwitterUrl} placeholder="https://x.com/..." placeholderTextColor={isDark ? "#52525b" : "#a1a1aa"} autoCapitalize="none" keyboardType="url" />
        <Text style={s.label}>🐙 GitHub</Text>
        <TextInput style={s.input} value={githubUrl} onChangeText={setGithubUrl} placeholder="https://github.com/..." placeholderTextColor={isDark ? "#52525b" : "#a1a1aa"} autoCapitalize="none" keyboardType="url" />
        <Text style={s.label}>🌐 Web サイト</Text>
        <TextInput style={s.input} value={websiteUrl} onChangeText={setWebsiteUrl} placeholder="https://..." placeholderTextColor={isDark ? "#52525b" : "#a1a1aa"} autoCapitalize="none" keyboardType="url" />

        <TouchableOpacity style={s.saveBtn} onPress={handleSave} disabled={saving}>
          {saving ? <ActivityIndicator color={isDark ? "#09090b" : "#fff"} /> : <Text style={s.saveBtnText}>保存</Text>}
        </TouchableOpacity>
      </View>

      {/* My Apps */}
      <View style={s.section}>
        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>投稿したアプリ（{apps.length}）</Text>
          <TouchableOpacity onPress={() => router.push("/(tabs)/submit")}>
            <Text style={s.addAppText}>+ 追加</Text>
          </TouchableOpacity>
        </View>
        {apps.map((app) => (
          <View key={app.id} style={s.appCard}>
            <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
              {app.icon_url ? (
                <Image source={{ uri: app.icon_url }} style={s.appIcon} />
              ) : (
                <View style={s.appIconPlaceholder}>
                  <Text style={s.appIconText}>{app.name[0]}</Text>
                </View>
              )}
              <View style={{ marginLeft: 12, flex: 1 }}>
                <Text style={s.appName} numberOfLines={1}>{app.name}</Text>
                <Text style={s.appTagline} numberOfLines={1}>{app.tagline}</Text>
              </View>
              <Text style={s.appLikes}>♥ {app.likes_count}</Text>
            </View>
            <View style={s.appActions}>
              <TouchableOpacity style={s.actionBtn} onPress={() => router.push(`/apps/${app.id}`)}>
                <Text style={s.actionBtnText}>見る</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.actionBtn} onPress={() => router.push(`/apps/${app.id}/edit`)}>
                <Text style={s.actionBtnText}>編集</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.actionBtn, s.deleteBtn]} onPress={() => handleDelete(app.id)}>
                <Text style={s.deleteBtnText}>削除</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </View>

      {/* Sign out */}
      <TouchableOpacity style={s.signOutBtn} onPress={handleSignOut}>
        <Text style={s.signOutBtnText}>ログアウト</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = (isDark: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: isDark ? "#09090b" : "#f4f4f5" },
  avatarRow: { flexDirection: "row", alignItems: "center", paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: isDark ? "#27272a" : "#e4e4e7", marginBottom: 20 },
  avatar: { width: 72, height: 72, borderRadius: 36 },
  avatarPlaceholder: { width: 72, height: 72, borderRadius: 36, backgroundColor: isDark ? "#27272a" : "#e4e4e7", alignItems: "center", justifyContent: "center" },
  avatarInitial: { fontSize: 28, fontWeight: "700", color: isDark ? "#71717a" : "#a1a1aa" },
  avatarEdit: { position: "absolute", bottom: 0, right: 0, width: 22, height: 22, borderRadius: 11, backgroundColor: "#09090b", alignItems: "center", justifyContent: "center" },
  usernameText: { fontSize: 18, fontWeight: "700", color: isDark ? "#ffffff" : "#09090b" },
  emailText: { fontSize: 12, color: isDark ? "#71717a" : "#a1a1aa", marginBottom: 6 },
  pointsBadge: { backgroundColor: isDark ? "#27272a" : "#f4f4f5", borderRadius: 99, paddingHorizontal: 10, paddingVertical: 4, alignSelf: "flex-start" },
  pointsText: { fontSize: 13, fontWeight: "600", color: isDark ? "#ffffff" : "#09090b" },
  section: { backgroundColor: isDark ? "#18181b" : "#ffffff", borderRadius: 14, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: isDark ? "#27272a" : "#e4e4e7" },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  sectionTitle: { fontSize: 14, fontWeight: "700", color: isDark ? "#a1a1aa" : "#71717a", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12 },
  publicLink: { marginBottom: 12 },
  publicLinkText: { fontSize: 13, color: isDark ? "#a1a1aa" : "#71717a", textDecorationLine: "underline" },
  label: { fontSize: 13, fontWeight: "600", color: isDark ? "#ffffff" : "#09090b", marginBottom: 6, marginTop: 12 },
  input: { backgroundColor: isDark ? "#09090b" : "#f4f4f5", borderWidth: 1, borderColor: isDark ? "#3f3f46" : "#e4e4e7", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: isDark ? "#ffffff" : "#09090b" },
  hint: { fontSize: 12, color: "#f59e0b", marginTop: 4 },
  saveBtn: { marginTop: 20, backgroundColor: isDark ? "#ffffff" : "#09090b", borderRadius: 10, paddingVertical: 14, alignItems: "center" },
  saveBtnText: { color: isDark ? "#09090b" : "#ffffff", fontSize: 15, fontWeight: "700" },
  addAppText: { fontSize: 14, fontWeight: "600", color: isDark ? "#a1a1aa" : "#71717a" },
  appCard: { borderTopWidth: 1, borderTopColor: isDark ? "#27272a" : "#f4f4f5", paddingTop: 12, marginTop: 8 },
  appIcon: { width: 44, height: 44, borderRadius: 10 },
  appIconPlaceholder: { width: 44, height: 44, borderRadius: 10, backgroundColor: isDark ? "#27272a" : "#f4f4f5", alignItems: "center", justifyContent: "center" },
  appIconText: { fontSize: 18, fontWeight: "700", color: isDark ? "#71717a" : "#a1a1aa" },
  appName: { fontSize: 14, fontWeight: "600", color: isDark ? "#ffffff" : "#09090b" },
  appTagline: { fontSize: 12, color: isDark ? "#71717a" : "#a1a1aa", marginTop: 2 },
  appLikes: { fontSize: 12, color: "#ef4444", marginLeft: 8 },
  appActions: { flexDirection: "row", gap: 8, marginTop: 10 },
  actionBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: isDark ? "#3f3f46" : "#e4e4e7", alignItems: "center" },
  actionBtnText: { fontSize: 13, color: isDark ? "#ffffff" : "#09090b" },
  deleteBtn: { borderColor: "#fca5a5" },
  deleteBtnText: { fontSize: 13, color: "#ef4444" },
  signOutBtn: { borderRadius: 10, paddingVertical: 14, alignItems: "center", borderWidth: 1, borderColor: isDark ? "#3f3f46" : "#e4e4e7" },
  signOutBtnText: { fontSize: 15, color: isDark ? "#71717a" : "#a1a1aa" },
});
