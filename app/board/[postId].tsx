import { useEffect, useState } from "react";
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, Alert,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
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
};

type Reply = {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  username?: string;
};

export default function BoardPostScreen() {
  const { postId } = useLocalSearchParams<{ postId: string }>();
  const { isDark } = useTheme();
  const s = styles(isDark);
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [post, setPost] = useState<Post | null>(null);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyText, setReplyText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));

    Promise.all([
      supabase.from("aa_board_posts").select("*").eq("id", postId).single(),
      supabase.from("aa_board_replies").select("*").eq("post_id", postId).order("created_at", { ascending: true }),
    ]).then(async ([postRes, repliesRes]) => {
      if (!postRes.data) { router.back(); return; }

      const userIds = [postRes.data.user_id, ...((repliesRes.data ?? []).map((r: Reply) => r.user_id))];
      const uniqueIds = [...new Set(userIds)];
      const { data: profiles } = await supabase.from("aa_profiles").select("id, username").in("id", uniqueIds);

      const profileMap: Record<string, string> = {};
      profiles?.forEach((p: { id: string; username: string }) => { profileMap[p.id] = p.username; });

      setPost({ ...postRes.data, username: profileMap[postRes.data.user_id] ?? "匿名" });
      setReplies((repliesRes.data ?? []).map((r: Reply) => ({ ...r, username: profileMap[r.user_id] ?? "匿名" })));
      setLoading(false);
    });
  }, [postId]);

  const handleReply = async () => {
    if (!user) { router.push("/auth"); return; }
    if (!replyText.trim()) return;
    setSubmitting(true);
    const { data } = await supabase
      .from("aa_board_replies")
      .insert({ post_id: postId, user_id: user.id, content: replyText.trim() })
      .select("*").single();
    if (data) {
      const { data: profile } = await supabase.from("aa_profiles").select("username").eq("id", user.id).single();
      setReplies((prev) => [...prev, { ...data, username: profile?.username ?? "匿名" }]);
      setReplyText("");
    }
    setSubmitting(false);
  };

  const handleDeleteReply = (replyId: string) => {
    if (!user) return;
    Alert.alert("削除", "この返信を削除しますか？", [
      { text: "キャンセル", style: "cancel" },
      {
        text: "削除", style: "destructive", onPress: async () => {
          await supabase.from("aa_board_replies").delete().eq("id", replyId).eq("user_id", user.id);
          setReplies((prev) => prev.filter((r) => r.id !== replyId));
        }
      },
    ]);
  };

  if (loading || !post) return null;

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <FlatList
        data={replies}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <View>
            <View style={s.postCard}>
              <Text style={s.postTitle}>{post.title}</Text>
              {post.content ? <Text style={s.postContent}>{post.content}</Text> : null}
              <View style={s.meta}>
                <Text style={s.metaTxt}>{post.username}</Text>
                <Text style={s.metaTxt}>{new Date(post.created_at).toLocaleDateString("ja-JP")}</Text>
              </View>
            </View>
            <Text style={s.repliesLabel}>返信 {replies.length}件</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={s.replyCard}>
            <Text style={s.replyContent}>{item.content}</Text>
            <View style={s.replyMeta}>
              <View style={s.meta}>
                <Text style={s.metaTxt}>{item.username}</Text>
                <Text style={s.metaTxt}>{new Date(item.created_at).toLocaleDateString("ja-JP")}</Text>
              </View>
              {user?.id === item.user_id && (
                <TouchableOpacity onPress={() => handleDeleteReply(item.id)}>
                  <Text style={s.deleteTxt}>削除</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
        ListEmptyComponent={<Text style={s.emptyTxt}>まだ返信がありません</Text>}
        contentContainerStyle={{ padding: 16, gap: 10 }}
      />

      {user ? (
        <View style={s.inputArea}>
          <TextInput
            style={s.textInput}
            value={replyText}
            onChangeText={setReplyText}
            placeholder="返信を入力..."
            placeholderTextColor={isDark ? "#52525b" : "#a1a1aa"}
            multiline
            maxLength={500}
          />
          <TouchableOpacity
            style={[s.sendBtn, (!replyText.trim() || submitting) && { opacity: 0.4 }]}
            onPress={handleReply}
            disabled={!replyText.trim() || submitting}
          >
            <Text style={s.sendTxt}>{submitting ? "..." : "送信"}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity style={s.loginPrompt} onPress={() => router.push("/auth")}>
          <Text style={s.loginPromptTxt}>返信するにはログインが必要です</Text>
        </TouchableOpacity>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = (isDark: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: isDark ? "#09090b" : "#f4f4f5" },
  postCard: {
    backgroundColor: isDark ? "#18181b" : "#fff", borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: isDark ? "#27272a" : "#e4e4e7", marginBottom: 8,
  },
  postTitle: { color: isDark ? "#fff" : "#09090b", fontWeight: "700", fontSize: 16, marginBottom: 6 },
  postContent: { color: isDark ? "#a1a1aa" : "#52525b", fontSize: 13, marginBottom: 10 },
  meta: { flexDirection: "row", gap: 10 },
  metaTxt: { color: "#71717a", fontSize: 11 },
  repliesLabel: { color: isDark ? "#a1a1aa" : "#52525b", fontSize: 13, fontWeight: "600", marginBottom: 6 },
  replyCard: {
    backgroundColor: isDark ? "#18181b" : "#fff", borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: isDark ? "#27272a" : "#e4e4e7",
  },
  replyContent: { color: isDark ? "#e4e4e7" : "#09090b", fontSize: 13, marginBottom: 8 },
  replyMeta: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  deleteTxt: { color: "#71717a", fontSize: 11 },
  emptyTxt: { color: "#71717a", fontSize: 13, textAlign: "center", marginTop: 30 },
  inputArea: {
    flexDirection: "row", padding: 12, gap: 8,
    borderTopWidth: 1, borderTopColor: isDark ? "#27272a" : "#e4e4e7",
    backgroundColor: isDark ? "#09090b" : "#fff",
  },
  textInput: {
    flex: 1, borderWidth: 1, borderColor: isDark ? "#3f3f46" : "#e4e4e7",
    borderRadius: 8, padding: 10, fontSize: 13, maxHeight: 100,
    color: isDark ? "#fff" : "#09090b", backgroundColor: isDark ? "#18181b" : "#f4f4f5",
  },
  sendBtn: {
    backgroundColor: isDark ? "#fff" : "#09090b", borderRadius: 8,
    paddingHorizontal: 16, justifyContent: "center",
  },
  sendTxt: { color: isDark ? "#09090b" : "#fff", fontWeight: "600", fontSize: 13 },
  loginPrompt: {
    padding: 16, borderTopWidth: 1, borderTopColor: isDark ? "#27272a" : "#e4e4e7",
    alignItems: "center", backgroundColor: isDark ? "#09090b" : "#fff",
  },
  loginPromptTxt: { color: "#71717a", fontSize: 13 },
});
