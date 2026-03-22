import { useEffect, useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, Image, ActivityIndicator, Share, Linking,
  Alert,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Clipboard from "expo-clipboard";
import { supabase } from "@/lib/supabase";
import { useTheme } from "@/lib/theme";
import Badge, { BadgeType } from "@/components/Badge";
import type { User } from "@supabase/supabase-js";

type App = {
  id: string; name: string; tagline: string; description: string;
  url: string | null; app_store_url: string | null; play_store_url: string | null;
  github_url: string | null; twitter_url: string | null; youtube_url: string | null;
  icon_url: string | null; screenshot_urls: string[] | null;
  tags: string[] | null; likes_count: number; created_at: string;
  user_id: string; status: string | null;
  tester_slots: number; tester_reward_points: number;
};
type Profile = { id: string; username: string; badge: string | null; avatar_url: string | null };
type Comment = { id: string; content: string; created_at: string; user_id: string };
type Application = { id: string; user_id: string; status: string; message: string | null };

export default function AppDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { isDark } = useTheme();
  const s = styles(isDark);
  const router = useRouter();

  const [app, setApp] = useState<App | null>(null);
  const [developer, setDeveloper] = useState<Profile | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentProfiles, setCommentProfiles] = useState<Record<string, string>>({});
  const [user, setUser] = useState<User | null>(null);
  const [liked, setLiked] = useState(false);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [activeShot, setActiveShot] = useState(0);
  const [application, setApplication] = useState<Application | null>(null);
  const [applyMsg, setApplyMsg] = useState("");
  const [applyOpen, setApplyOpen] = useState(false);
  const [applying, setApplying] = useState(false);
  const [totalApplicants, setTotalApplicants] = useState(0);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));

    supabase.from("aa_apps").select("*").eq("id", id).single()
      .then(({ data }) => {
        if (!data || data.is_hidden) { router.replace("/"); return; }
        setApp(data as App);
        supabase.from("aa_profiles").select("id, username, badge, avatar_url")
          .eq("id", data.user_id).single()
          .then(({ data: p }) => { if (p) setDeveloper(p as Profile); });
      });

    supabase.from("aa_comments").select("*").eq("app_id", id).order("created_at", { ascending: true })
      .then(({ data }) => {
        if (!data) return;
        setComments(data as Comment[]);
        const userIds = [...new Set(data.map((c: Comment) => c.user_id))];
        if (userIds.length > 0) {
          supabase.from("aa_profiles").select("id, username").in("id", userIds)
            .then(({ data: profiles }) => {
              const map: Record<string, string> = {};
              profiles?.forEach((p: { id: string; username: string }) => { map[p.id] = p.username; });
              setCommentProfiles(map);
            });
        }
      });

    supabase.from("aa_tester_applications").select("id", { count: "exact" }).eq("app_id", id)
      .then(({ count }) => setTotalApplicants(count ?? 0));
  }, [id]);

  useEffect(() => {
    if (!user) return;
    supabase.from("aa_likes").select("id").eq("app_id", id).eq("user_id", user.id)
      .maybeSingle().then(({ data }) => setLiked(!!data));
    supabase.from("aa_tester_applications").select("*").eq("app_id", id).eq("user_id", user.id)
      .maybeSingle().then(({ data }) => setApplication(data as Application | null));
  }, [user, id]);

  const handleLike = async () => {
    if (!user) { router.push("/auth"); return; }
    if (liked) {
      await supabase.from("aa_likes").delete().eq("app_id", id).eq("user_id", user.id);
      setLiked(false);
      setApp((a) => a ? { ...a, likes_count: Math.max(0, a.likes_count - 1) } : a);
    } else {
      await supabase.from("aa_likes").insert({ app_id: id, user_id: user.id });
      setLiked(true);
      setApp((a) => a ? { ...a, likes_count: a.likes_count + 1 } : a);
    }
  };

  const handleComment = async () => {
    if (!user || !comment.trim()) return;
    setSubmitting(true);
    const { data } = await supabase.from("aa_comments")
      .insert({ app_id: id, user_id: user.id, content: comment.trim() })
      .select("*").single();
    if (data) {
      setComments((prev) => [...prev, data as Comment]);
      setCommentProfiles((prev) => ({ ...prev, [user.id]: prev[user.id] ?? user.email ?? "?" }));
      await supabase.from("aa_points").insert({
        user_id: user.id, amount: 2,
        reason: `「${app?.name}」にコメント`, app_id: id,
      });
    }
    setComment("");
    setSubmitting(false);
  };

  const handleApply = async () => {
    if (!user) { router.push("/auth"); return; }
    setApplying(true);
    const { data } = await supabase.from("aa_tester_applications")
      .insert({ app_id: id, user_id: user.id, message: applyMsg.trim() || null })
      .select("*").single();
    if (data) {
      setApplication(data as Application);
      setTotalApplicants((n) => n + 1);
      await supabase.from("aa_points").insert({
        user_id: user.id, amount: 1,
        reason: `「${app?.name}」のテスターに申請`, app_id: id,
      });
    }
    setApplyOpen(false);
    setApplying(false);
  };

  const handleShare = async () => {
    await Share.share({ message: `${app?.name} - ${app?.tagline}` });
  };

  if (!app) return <ActivityIndicator style={{ flex: 1 }} />;

  const shots = app.screenshot_urls ?? [];
  const isTesterApp = (app.tester_slots ?? 0) > 0;
  const isOwner = user?.id === app.user_id;

  const statusColor = !app.status || app.status === "released"
    ? { bg: isDark ? "#14532d" : "#dcfce7", text: isDark ? "#86efac" : "#16a34a", label: "✓ リリース済み" }
    : app.status === "beta"
    ? { bg: isDark ? "#1e3a5f" : "#dbeafe", text: isDark ? "#93c5fd" : "#2563eb", label: "β ベータ版" }
    : { bg: isDark ? "#451a03" : "#fef3c7", text: isDark ? "#fcd34d" : "#d97706", label: "🚧 開発中" };

  return (
    <ScrollView style={s.container} contentContainerStyle={{ paddingBottom: 60 }}>
      {/* Header */}
      <View style={s.header}>
        {app.icon_url ? (
          <Image source={{ uri: app.icon_url }} style={s.appIcon} />
        ) : (
          <View style={s.appIconPlaceholder}>
            <Text style={{ fontSize: 32, fontWeight: "700", color: isDark ? "#71717a" : "#a1a1aa" }}>{app.name[0]}</Text>
          </View>
        )}
        <View style={{ flex: 1, marginLeft: 16 }}>
          <Text style={s.appName}>{app.name}</Text>
          <Text style={s.tagline}>{app.tagline}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 }}>
            <View style={[s.statusBadge, { backgroundColor: statusColor.bg }]}>
              <Text style={[s.statusText, { color: statusColor.text }]}>{statusColor.label}</Text>
            </View>
            {isOwner && (
              <View style={{ flexDirection: "row", gap: 10 }}>
                <TouchableOpacity onPress={() => router.push(`/apps/${app.id}/edit`)}>
                  <Text style={s.editLink}>編集</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => router.push(`/apps/${app.id}/testers`)}>
                  <Text style={s.editLink}>テスター管理</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
        <TouchableOpacity onPress={handleLike} style={{ alignItems: "center" }}>
          <Text style={{ fontSize: 28, color: liked ? "#ef4444" : isDark ? "#3f3f46" : "#d4d4d8" }}>♥</Text>
          <Text style={s.likesCount}>{app.likes_count}</Text>
        </TouchableOpacity>
      </View>

      {/* Developer */}
      {developer && (
        <TouchableOpacity style={s.developerRow} onPress={() => router.push(`/users/${developer.username}`)}>
          {developer.avatar_url ? (
            <Image source={{ uri: developer.avatar_url }} style={s.devAvatar} />
          ) : (
            <View style={s.devAvatarPlaceholder}>
              <Text style={{ fontSize: 12, fontWeight: "700", color: isDark ? "#71717a" : "#a1a1aa" }}>
                {developer.username?.[0]?.toUpperCase()}
              </Text>
            </View>
          )}
          <Text style={s.devName}>{developer.username}</Text>
          {developer.badge && <Badge badge={developer.badge as BadgeType} size="xs" />}
          <Text style={{ color: isDark ? "#71717a" : "#a1a1aa", fontSize: 12, marginLeft: "auto" }}>→</Text>
        </TouchableOpacity>
      )}

      {/* Tags */}
      {app.tags && app.tags.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ paddingHorizontal: 16, marginBottom: 16 }}>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {app.tags.map((tag) => (
              <View key={tag} style={s.tag}><Text style={s.tagText}>{tag}</Text></View>
            ))}
          </View>
        </ScrollView>
      )}

      {/* Action buttons */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ paddingHorizontal: 16, marginBottom: 20 }}>
        <View style={{ flexDirection: "row", gap: 10 }}>
          {app.app_store_url && <TouchableOpacity style={s.actionBtn} onPress={() => Linking.openURL(app.app_store_url!)}><Text style={s.actionBtnText}>🍎 App Store</Text></TouchableOpacity>}
          {app.play_store_url && <TouchableOpacity style={s.actionBtn} onPress={() => Linking.openURL(app.play_store_url!)}><Text style={s.actionBtnText}>▶ Google Play</Text></TouchableOpacity>}
          {app.url && <TouchableOpacity style={s.actionBtnOutline} onPress={() => Linking.openURL(app.url!)}><Text style={s.actionBtnOutlineText}>🌐 Web</Text></TouchableOpacity>}
          {app.github_url && <TouchableOpacity style={s.actionBtnOutline} onPress={() => Linking.openURL(app.github_url!)}><Text style={s.actionBtnOutlineText}>🐙 GitHub</Text></TouchableOpacity>}
          {app.twitter_url && <TouchableOpacity style={s.actionBtnOutline} onPress={() => Linking.openURL(app.twitter_url!)}><Text style={s.actionBtnOutlineText}>𝕏 フォロー</Text></TouchableOpacity>}
          <TouchableOpacity style={s.actionBtnOutline} onPress={handleShare}><Text style={s.actionBtnOutlineText}>🔗 シェア</Text></TouchableOpacity>
        </View>
      </ScrollView>

      {/* Tester */}
      {isTesterApp && (
        <View style={s.testerBox}>
          <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }}>
            <View>
              <Text style={s.testerTitle}>🧪 テスター募集中</Text>
              <Text style={s.testerSlots}>{totalApplicants}/{app.tester_slots}人 · {app.tester_reward_points}pt獲得</Text>
            </View>
            {!isOwner && !application && (
              <TouchableOpacity
                style={[s.applyBtn, totalApplicants >= app.tester_slots && { opacity: 0.5 }]}
                onPress={() => setApplyOpen(true)}
                disabled={totalApplicants >= app.tester_slots}
              >
                <Text style={s.applyBtnText}>{totalApplicants >= app.tester_slots ? "満員" : "申請する"}</Text>
              </TouchableOpacity>
            )}
            {!isOwner && application && (
              <View style={s.appliedBadge}>
                <Text style={s.appliedBadgeText}>
                  {application.status === "approved" ? "承認済み ✓" : "申請済み"}
                </Text>
              </View>
            )}
          </View>
          {applyOpen && (
            <View style={{ marginTop: 12 }}>
              <TextInput
                style={s.applyInput}
                value={applyMsg}
                onChangeText={setApplyMsg}
                placeholder="自己紹介や参加理由（任意）"
                placeholderTextColor={isDark ? "#52525b" : "#a1a1aa"}
                multiline
                numberOfLines={3}
              />
              <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                <TouchableOpacity style={s.applyCancel} onPress={() => setApplyOpen(false)}>
                  <Text style={{ color: isDark ? "#a1a1aa" : "#71717a", fontSize: 14 }}>キャンセル</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.applyBtn, { flex: 1 }]} onPress={handleApply} disabled={applying}>
                  <Text style={s.applyBtnText}>{applying ? "申請中..." : "申請する"}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      )}

      {/* Screenshots */}
      {shots.length > 0 && (
        <View style={{ marginBottom: 24 }}>
          <Text style={s.sectionTitle}>スクリーンショット</Text>
          <Image source={{ uri: shots[activeShot] }} style={s.mainShot} resizeMode="contain" />
          {shots.length > 1 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ paddingHorizontal: 16 }}>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {shots.map((src, i) => (
                  <TouchableOpacity key={i} onPress={() => setActiveShot(i)}>
                    <Image
                      source={{ uri: src }}
                      style={[s.thumbShot, i === activeShot && s.thumbShotActive]}
                    />
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          )}
        </View>
      )}

      {/* Description */}
      {app.description ? (
        <View style={{ paddingHorizontal: 16, marginBottom: 24 }}>
          <Text style={s.sectionTitle}>About</Text>
          <Text style={s.description}>{app.description}</Text>
        </View>
      ) : null}

      {/* Comments */}
      <View style={{ paddingHorizontal: 16 }}>
        <Text style={s.sectionTitle}>コメント（{comments.length}）</Text>
        {comments.map((c) => (
          <View key={c.id} style={s.commentItem}>
            <View style={s.commentAvatar}>
              <Text style={{ fontSize: 12, fontWeight: "700", color: isDark ? "#a1a1aa" : "#71717a" }}>
                {(commentProfiles[c.user_id] ?? "?")[0].toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.commentUser}>{commentProfiles[c.user_id] ?? "anonymous"}</Text>
              <Text style={s.commentContent}>{(c as { content: string }).content}</Text>
            </View>
          </View>
        ))}
        {comments.length === 0 && <Text style={s.emptyText}>コメントはまだありません</Text>}

        {user ? (
          <View style={s.commentInputRow}>
            <TextInput
              style={s.commentInput}
              value={comment}
              onChangeText={setComment}
              placeholder="コメントを書く..."
              placeholderTextColor={isDark ? "#52525b" : "#a1a1aa"}
              maxLength={500}
            />
            <TouchableOpacity
              style={[s.sendBtn, (!comment.trim() || submitting) && { opacity: 0.4 }]}
              onPress={handleComment}
              disabled={!comment.trim() || submitting}
            >
              <Text style={s.sendBtnText}>送信</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity onPress={() => router.push("/auth")}>
            <Text style={s.loginPrompt}>ログインしてコメントする →</Text>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );
}

const styles = (isDark: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: isDark ? "#09090b" : "#f4f4f5" },
  header: { flexDirection: "row", padding: 20, alignItems: "flex-start" },
  appIcon: { width: 80, height: 80, borderRadius: 18 },
  appIconPlaceholder: { width: 80, height: 80, borderRadius: 18, backgroundColor: isDark ? "#27272a" : "#e4e4e7", alignItems: "center", justifyContent: "center" },
  appName: { fontSize: 22, fontWeight: "700", color: isDark ? "#ffffff" : "#09090b" },
  tagline: { fontSize: 13, color: isDark ? "#a1a1aa" : "#71717a", marginTop: 4 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99 },
  statusText: { fontSize: 11, fontWeight: "600" },
  editLink: { fontSize: 12, color: isDark ? "#a1a1aa" : "#71717a", textDecorationLine: "underline" },
  likesCount: { fontSize: 13, color: isDark ? "#71717a" : "#a1a1aa" },
  developerRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: isDark ? "#18181b" : "#ffffff", marginHorizontal: 16, marginBottom: 16, borderRadius: 12, borderWidth: 1, borderColor: isDark ? "#27272a" : "#e4e4e7" },
  devAvatar: { width: 28, height: 28, borderRadius: 14 },
  devAvatarPlaceholder: { width: 28, height: 28, borderRadius: 14, backgroundColor: isDark ? "#27272a" : "#e4e4e7", alignItems: "center", justifyContent: "center" },
  devName: { fontSize: 13, fontWeight: "600", color: isDark ? "#ffffff" : "#09090b" },
  tag: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 99, backgroundColor: isDark ? "#27272a" : "#e4e4e7" },
  tagText: { fontSize: 12, color: isDark ? "#a1a1aa" : "#71717a" },
  actionBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, backgroundColor: isDark ? "#ffffff" : "#09090b" },
  actionBtnText: { fontSize: 13, fontWeight: "600", color: isDark ? "#09090b" : "#ffffff" },
  actionBtnOutline: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: isDark ? "#3f3f46" : "#e4e4e7" },
  actionBtnOutlineText: { fontSize: 13, fontWeight: "500", color: isDark ? "#ffffff" : "#09090b" },
  testerBox: { marginHorizontal: 16, marginBottom: 20, padding: 16, borderRadius: 14, backgroundColor: isDark ? "#0c1a2e" : "#eff6ff", borderWidth: 1, borderColor: isDark ? "#1e3a5f" : "#bfdbfe" },
  testerTitle: { fontSize: 14, fontWeight: "700", color: isDark ? "#93c5fd" : "#1d4ed8", marginBottom: 4 },
  testerSlots: { fontSize: 12, color: isDark ? "#60a5fa" : "#3b82f6" },
  applyBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, backgroundColor: "#2563eb", alignItems: "center" },
  applyBtnText: { color: "#ffffff", fontSize: 13, fontWeight: "600" },
  appliedBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: isDark ? "#1e3a5f" : "#dbeafe" },
  appliedBadgeText: { fontSize: 12, color: isDark ? "#93c5fd" : "#2563eb", fontWeight: "600" },
  applyInput: { backgroundColor: isDark ? "#09090b" : "#ffffff", borderWidth: 1, borderColor: isDark ? "#1e3a5f" : "#bfdbfe", borderRadius: 10, padding: 12, fontSize: 14, color: isDark ? "#ffffff" : "#09090b", textAlignVertical: "top", minHeight: 80 },
  applyCancel: { flex: 1, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: isDark ? "#3f3f46" : "#e4e4e7", alignItems: "center" },
  sectionTitle: { fontSize: 12, fontWeight: "700", color: isDark ? "#71717a" : "#a1a1aa", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12 },
  mainShot: { width: "100%", height: 240, backgroundColor: isDark ? "#18181b" : "#e4e4e7", marginBottom: 10 },
  thumbShot: { width: 64, height: 44, borderRadius: 8, borderWidth: 2, borderColor: "transparent" },
  thumbShotActive: { borderColor: isDark ? "#ffffff" : "#09090b" },
  description: { fontSize: 14, color: isDark ? "#d4d4d8" : "#3f3f46", lineHeight: 22 },
  commentItem: { flexDirection: "row", gap: 10, marginBottom: 16 },
  commentAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: isDark ? "#27272a" : "#e4e4e7", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  commentUser: { fontSize: 12, color: isDark ? "#71717a" : "#a1a1aa", marginBottom: 2 },
  commentContent: { fontSize: 14, color: isDark ? "#d4d4d8" : "#3f3f46" },
  emptyText: { fontSize: 13, color: isDark ? "#52525b" : "#a1a1aa", marginBottom: 16 },
  commentInputRow: { flexDirection: "row", gap: 8, marginTop: 8, marginBottom: 20 },
  commentInput: { flex: 1, backgroundColor: isDark ? "#18181b" : "#ffffff", borderWidth: 1, borderColor: isDark ? "#3f3f46" : "#e4e4e7", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: isDark ? "#ffffff" : "#09090b" },
  sendBtn: { backgroundColor: isDark ? "#ffffff" : "#09090b", borderRadius: 10, paddingHorizontal: 16, alignItems: "center", justifyContent: "center" },
  sendBtnText: { color: isDark ? "#09090b" : "#ffffff", fontWeight: "600", fontSize: 13 },
  loginPrompt: { fontSize: 13, color: isDark ? "#71717a" : "#a1a1aa", textDecorationLine: "underline", marginTop: 8 },
});
