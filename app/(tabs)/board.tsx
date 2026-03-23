import { useEffect, useState, useCallback } from "react";
import {
  View, Text, FlatList, TouchableOpacity, TextInput,
  StyleSheet, RefreshControl, KeyboardAvoidingView, Platform, Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useTheme } from "@/lib/theme";
import type { User } from "@supabase/supabase-js";

type Post = {
  id: string;
  user_id: string;
  title: string;
  content: string | null;
  created_at: string;
  username?: string;
  reply_count?: number;
};

export default function BoardScreen() {
  const { isDark } = useTheme();
  const s = styles(isDark);
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    fetchPosts();
  }, []);

  const fetchPosts = useCallback(async () => {
    const { data } = await supabase
      .from("aa_board_posts")
      .select("id, user_id, title, content, created_at")
      .order("created_at", { ascending: false });

    if (!data) { setLoading(false); setRefreshing(false); return; }

    const userIds = [...new Set(data.map((p: Post) => p.user_id))];
    const postIds = data.map((p: Post) => p.id);

    const [profilesRes, repliesRes] = await Promise.all([
      supabase.from("aa_profiles").select("id, username").in("id", userIds),
      supabase.from("aa_board_replies").select("id, post_id").in("post_id", postIds),
    ]);

    const profileMap: Record<string, string> = {};
    profilesRes.data?.forEach((p: { id: string; username: string }) => {
      profileMap[p.id] = p.username;
    });

    const replyCount: Record<string, number> = {};
    repliesRes.data?.forEach((r: { id: string; post_id: string }) => {
      replyCount[r.post_id] = (replyCount[r.post_id] ?? 0) + 1;
    });

    setPosts(data.map((p: Post) => ({
      ...p,
      username: profileMap[p.user_id] ?? "匿名",
      reply_count: replyCount[p.id] ?? 0,
    })));
    setLoading(false);
    setRefreshing(false);
  }, []);

  const handleSubmit = async () => {
    if (!user) { router.push("/auth"); return; }
    if (!title.trim()) return;
    setSubmitting(true);
    const { data } = await supabase
      .from("aa_board_posts")
      .insert({ user_id: user.id, title: title.trim(), content: content.trim() || null })
      .select("id, user_id, title, content, created_at").single();
    if (data) {
      const { data: profile } = await supabase
        .from("aa_profiles").select("username").eq("id", user.id).single();
      setPosts((prev) => [{ ...data, username: profile?.username ?? "匿名", reply_count: 0 }, ...prev]);
      setTitle("");
      setContent("");
      setFormOpen(false);
    }
    setSubmitting(false);
  };

  const handleDelete = (postId: string) => {
    if (!user) return;
    Alert.alert("削除", "このスレッドを削除しますか？", [
      { text: "キャンセル", style: "cancel" },
      {
        text: "削除", style: "destructive", onPress: async () => {
          await supabase.from("aa_board_posts").delete().eq("id", postId).eq("user_id", user.id);
          setPosts((prev) => prev.filter((p) => p.id !== postId));
        }
      },
    ]);
  };

  const renderPost = ({ item }: { item: Post }) => (
    <TouchableOpacity style={s.card} onPress={() => router.push(`/board/${item.id}`)}>
      <Text style={s.cardTitle}>{item.title}</Text>
      {item.content ? <Text style={s.cardContent} numberOfLines={2}>{item.content}</Text> : null}
      <View style={s.cardMeta}>
        <Text style={s.metaText}>{item.username}</Text>
        <Text style={s.metaText}>{new Date(item.created_at).toLocaleDateString("ja-JP")}</Text>
        <Text style={s.metaText}>💬 {item.reply_count}</Text>
      </View>
      {user?.id === item.user_id && (
        <TouchableOpacity onPress={() => handleDelete(item.id)} style={s.deleteBtn}>
          <Text style={s.deleteTxt}>削除</Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      {formOpen && (
        <View style={s.form}>
          <Text style={s.formTitle}>新しいスレッド</Text>
          <TextInput
            style={s.input}
            value={title}
            onChangeText={setTitle}
            placeholder="タイトル"
            placeholderTextColor={isDark ? "#52525b" : "#a1a1aa"}
            maxLength={100}
          />
          <TextInput
            style={[s.input, { height: 80 }]}
            value={content}
            onChangeText={setContent}
            placeholder="詳しい説明（任意）"
            placeholderTextColor={isDark ? "#52525b" : "#a1a1aa"}
            multiline
            maxLength={1000}
          />
          <View style={s.formButtons}>
            <TouchableOpacity style={s.cancelBtn} onPress={() => setFormOpen(false)}>
              <Text style={s.cancelTxt}>キャンセル</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.submitBtn, (!title.trim() || submitting) && { opacity: 0.4 }]}
              onPress={handleSubmit}
              disabled={!title.trim() || submitting}
            >
              <Text style={s.submitTxt}>{submitting ? "投稿中..." : "投稿する"}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        renderItem={renderPost}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchPosts(); }} />}
        ListHeaderComponent={
          !formOpen && user ? (
            <TouchableOpacity style={s.newBtn} onPress={() => setFormOpen(true)}>
              <Text style={s.newBtnTxt}>＋ スレッドを立てる</Text>
            </TouchableOpacity>
          ) : null
        }
        ListEmptyComponent={
          !loading ? (
            <View style={s.empty}>
              <Text style={{ fontSize: 40 }}>💭</Text>
              <Text style={s.emptyTxt}>まだスレッドがありません</Text>
            </View>
          ) : null
        }
        contentContainerStyle={{ padding: 16, gap: 12 }}
      />
    </KeyboardAvoidingView>
  );
}

const styles = (isDark: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: isDark ? "#09090b" : "#f4f4f5" },
  card: {
    backgroundColor: isDark ? "#18181b" : "#ffffff",
    borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: isDark ? "#27272a" : "#e4e4e7",
  },
  cardTitle: { color: isDark ? "#ffffff" : "#09090b", fontWeight: "600", fontSize: 14, marginBottom: 4 },
  cardContent: { color: isDark ? "#a1a1aa" : "#71717a", fontSize: 12, marginBottom: 8 },
  cardMeta: { flexDirection: "row", gap: 10 },
  metaText: { color: "#71717a", fontSize: 11 },
  deleteBtn: { marginTop: 8 },
  deleteTxt: { color: "#71717a", fontSize: 11 },
  form: {
    backgroundColor: isDark ? "#18181b" : "#ffffff",
    margin: 16, borderRadius: 12, padding: 16,
    borderWidth: 1, borderColor: isDark ? "#27272a" : "#e4e4e7",
  },
  formTitle: { color: isDark ? "#fff" : "#09090b", fontWeight: "600", fontSize: 14, marginBottom: 10 },
  input: {
    borderWidth: 1, borderColor: isDark ? "#3f3f46" : "#e4e4e7",
    borderRadius: 8, padding: 10, fontSize: 13,
    color: isDark ? "#fff" : "#09090b",
    backgroundColor: isDark ? "#09090b" : "#f4f4f5",
    marginBottom: 10,
  },
  formButtons: { flexDirection: "row", gap: 8, justifyContent: "flex-end" },
  cancelBtn: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8, borderWidth: 1, borderColor: isDark ? "#3f3f46" : "#e4e4e7" },
  cancelTxt: { color: isDark ? "#a1a1aa" : "#71717a", fontSize: 13 },
  submitBtn: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8, backgroundColor: isDark ? "#ffffff" : "#09090b" },
  submitTxt: { color: isDark ? "#09090b" : "#ffffff", fontSize: 13, fontWeight: "600" },
  newBtn: {
    backgroundColor: isDark ? "#27272a" : "#09090b",
    borderRadius: 20, padding: 10, alignItems: "center", marginBottom: 4,
  },
  newBtnTxt: { color: isDark ? "#fff" : "#fff", fontSize: 13, fontWeight: "600" },
  empty: { alignItems: "center", marginTop: 60, gap: 10 },
  emptyTxt: { color: "#71717a", fontSize: 13 },
});
