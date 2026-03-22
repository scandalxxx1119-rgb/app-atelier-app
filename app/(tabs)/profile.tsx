import { useEffect, useState, useCallback } from "react";
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Image, Alert, ActivityIndicator, Linking,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useTheme } from "@/lib/theme";
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
  const { isDark } = useTheme();
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
  const [screenshotExtended, setScreenshotExtended] = useState(false);
  const [activeBoosts, setActiveBoosts] = useState<{ app_id: string; type: string; expires_at: string }[]>([]);
  const [memberCount, setMemberCount] = useState<number | null>(null);
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
        .select("username, badge, username_updated_at, bio, twitter_url, github_url, website_url, avatar_url, screenshot_extended")
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
    const appsData = (appsRes.data as App[]) ?? [];
    setApps(appsData);
    setScreenshotExtended(profileRes.data?.screenshot_extended ?? false);
    const total = (pointsRes.data ?? []).reduce((sum: number, r: { amount: number }) => sum + r.amount, 0);
    setPoints(total);

    if (appsData.length > 0) {
      const now = new Date().toISOString();
      const { data: boosts } = await supabase.from("aa_boosts")
        .select("app_id, type, expires_at")
        .in("app_id", appsData.map((a) => a.id))
        .gt("expires_at", now);
      setActiveBoosts(boosts ?? []);
    }

    if (profileRes.data?.badge === "master") {
      const { count } = await supabase.from("aa_profiles").select("*", { count: "exact", head: true });
      setMemberCount(count ?? 0);
    }

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

  const handleBuyScreenshot = async () => {
    if (!user) return;
    if (points < 10) { Alert.alert("ポイント不足", "スクリーンショット拡張には10ptが必要です"); return; }
    Alert.alert("確認", "スクリーンショット拡張を購入しますか？（10pt）", [
      { text: "キャンセル", style: "cancel" },
      {
        text: "購入する",
        onPress: async () => {
          await supabase.from("aa_profiles").update({ screenshot_extended: true }).eq("id", user.id);
          await supabase.from("aa_points").insert({ user_id: user.id, amount: -10, reason: "スクリーンショット拡張購入" });
          setScreenshotExtended(true);
          setPoints((p) => p - 10);
        },
      },
    ]);
  };

  const handleBoost = async (appId: string, type: "gold" | "pickup") => {
    if (!user) return;
    const cost = type === "gold" ? 25 : 50;
    const days = type === "gold" ? 3 : 2;
    const label = type === "gold" ? "ゴールドブースト" : "ピックアップ";
    if (points < cost) { Alert.alert("ポイント不足", `${label}には${cost}ptが必要です`); return; }
    const appName = apps.find((a) => a.id === appId)?.name ?? "";
    Alert.alert("確認", `「${appName}」を${label}（${days}日間）しますか？\n${cost}pt消費します`, [
      { text: "キャンセル", style: "cancel" },
      {
        text: "購入する",
        onPress: async () => {
          const expires = new Date();
          expires.setDate(expires.getDate() + days);
          await supabase.from("aa_boosts").insert({
            app_id: appId, user_id: user.id, type, expires_at: expires.toISOString(),
          });
          await supabase.from("aa_points").insert({
            user_id: user.id, amount: -cost, reason: `${label}（${appName}）`, app_id: appId,
          });
          setPoints((p) => p - cost);
          setActiveBoosts((prev) => [...prev, { app_id: appId, type, expires_at: expires.toISOString() }]);
        },
      },
    ]);
  };

  const boostExpiry = (expiresAt: string) => {
    const diff = new Date(expiresAt).getTime() - Date.now();
    const hours = Math.ceil(diff / (1000 * 60 * 60));
    return hours > 24 ? `残${Math.ceil(hours / 24)}日` : `残${hours}h`;
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
          {memberCount !== null && (
            <View style={[s.pointsBadge, { marginTop: 4, backgroundColor: isDark ? "#2e1065" : "#ede9fe" }]}>
              <Text style={[s.pointsText, { color: isDark ? "#c4b5fd" : "#7c3aed" }]}>👥 {memberCount} 人</Text>
            </View>
          )}
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

      {/* Point Shop */}
      <View style={s.section}>
        <Text style={s.sectionTitle}>ポイントショップ</Text>

        {/* Screenshot extension */}
        <View style={s.shopRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.shopItemTitle}>📸 スクリーンショット拡張</Text>
            <Text style={s.shopItemDesc}>最大10枚まで（永続・1回限り）</Text>
          </View>
          {screenshotExtended ? (
            <View style={s.purchasedBadge}><Text style={s.purchasedText}>購入済み</Text></View>
          ) : (
            <TouchableOpacity style={s.buyBtn} onPress={handleBuyScreenshot}>
              <Text style={s.buyBtnText}>10pt</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* App boosts */}
        {apps.length > 0 && (
          <View style={{ marginTop: 16 }}>
            <Text style={s.shopSubTitle}>アプリブースト</Text>
            {apps.map((app) => {
              const goldBoost = activeBoosts.find((b) => b.app_id === app.id && b.type === "gold");
              const pickupBoost = activeBoosts.find((b) => b.app_id === app.id && b.type === "pickup");
              return (
                <View key={app.id} style={s.boostCard}>
                  <Text style={s.boostAppName} numberOfLines={1}>{app.name}</Text>
                  <View style={{ gap: 8, marginTop: 8 }}>
                    {goldBoost ? (
                      <View style={[s.activeBadge, { backgroundColor: isDark ? "#451a03" : "#fef3c7" }]}>
                        <Text style={{ fontSize: 12, color: isDark ? "#fcd34d" : "#d97706", fontWeight: "600" }}>
                          ⭐ ゴールドブースト中 {boostExpiry(goldBoost.expires_at)}
                        </Text>
                      </View>
                    ) : (
                      <TouchableOpacity style={s.boostBtn} onPress={() => handleBoost(app.id, "gold")}>
                        <Text style={s.boostBtnText}>⭐ ゴールドブースト  25pt（3日間）</Text>
                      </TouchableOpacity>
                    )}
                    {pickupBoost ? (
                      <View style={[s.activeBadge, { backgroundColor: isDark ? "#2e1065" : "#ede9fe" }]}>
                        <Text style={{ fontSize: 12, color: isDark ? "#c4b5fd" : "#7c3aed", fontWeight: "600" }}>
                          🔥 ピックアップ中 {boostExpiry(pickupBoost.expires_at)}
                        </Text>
                      </View>
                    ) : (
                      <TouchableOpacity style={[s.boostBtn, s.pickupBtn]} onPress={() => handleBoost(app.id, "pickup")}>
                        <Text style={[s.boostBtnText, { color: isDark ? "#c4b5fd" : "#7c3aed" }]}>🔥 ピックアップ  50pt（2日間）</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </View>

      {/* Legal links */}
      <View style={s.legalSection}>
        <TouchableOpacity onPress={() => Linking.openURL("https://app-atelier.vercel.app/terms")}>
          <Text style={s.legalLink}>利用規約</Text>
        </TouchableOpacity>
        <Text style={s.legalSep}>·</Text>
        <TouchableOpacity onPress={() => Linking.openURL("https://app-atelier.vercel.app/privacy")}>
          <Text style={s.legalLink}>プライバシーポリシー</Text>
        </TouchableOpacity>
        <Text style={s.legalSep}>·</Text>
        <TouchableOpacity onPress={() => Linking.openURL("https://app-atelier.vercel.app/contact")}>
          <Text style={s.legalLink}>お問い合わせ</Text>
        </TouchableOpacity>
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
  legalSection: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8, marginBottom: 16 },
  legalLink: { fontSize: 13, color: isDark ? "#71717a" : "#a1a1aa", textDecorationLine: "underline" },
  legalSep: { fontSize: 13, color: isDark ? "#3f3f46" : "#d4d4d8" },
  signOutBtn: { borderRadius: 10, paddingVertical: 14, alignItems: "center", borderWidth: 1, borderColor: isDark ? "#3f3f46" : "#e4e4e7" },
  signOutBtnText: { fontSize: 15, color: isDark ? "#71717a" : "#a1a1aa" },
  shopRow: { flexDirection: "row", alignItems: "center", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: isDark ? "#27272a" : "#f4f4f5" },
  shopItemTitle: { fontSize: 14, fontWeight: "600", color: isDark ? "#ffffff" : "#09090b" },
  shopItemDesc: { fontSize: 12, color: isDark ? "#71717a" : "#a1a1aa", marginTop: 2 },
  purchasedBadge: { backgroundColor: isDark ? "#14532d" : "#dcfce7", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  purchasedText: { fontSize: 12, fontWeight: "600", color: isDark ? "#86efac" : "#16a34a" },
  buyBtn: { backgroundColor: isDark ? "#ffffff" : "#09090b", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  buyBtnText: { fontSize: 13, fontWeight: "700", color: isDark ? "#09090b" : "#ffffff" },
  shopSubTitle: { fontSize: 12, fontWeight: "700", color: isDark ? "#71717a" : "#a1a1aa", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 },
  boostCard: { backgroundColor: isDark ? "#09090b" : "#f4f4f5", borderRadius: 10, padding: 12, marginBottom: 10 },
  boostAppName: { fontSize: 13, fontWeight: "600", color: isDark ? "#ffffff" : "#09090b" },
  boostBtn: { backgroundColor: isDark ? "#27272a" : "#ffffff", borderWidth: 1, borderColor: isDark ? "#3f3f46" : "#e4e4e7", borderRadius: 8, paddingVertical: 10, paddingHorizontal: 14 },
  pickupBtn: { borderColor: isDark ? "#7c3aed" : "#c4b5fd" },
  boostBtnText: { fontSize: 13, fontWeight: "600", color: isDark ? "#fcd34d" : "#d97706" },
  activeBadge: { borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12 },
});
