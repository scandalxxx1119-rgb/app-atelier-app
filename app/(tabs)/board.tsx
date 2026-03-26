import { useEffect, useState, useCallback } from "react";
import {
  View, Text, FlatList, TouchableOpacity, TextInput,
  StyleSheet, RefreshControl, Modal, ScrollView,
  KeyboardAvoidingView, Platform, Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useTheme } from "@/lib/theme";
import type { User } from "@supabase/supabase-js";

type Idea = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  category: string | null;
  created_at: string;
  username?: string;
  wants_count?: number;
  builds_count?: number;
  user_wanted?: boolean;
};

const CATEGORIES = ["ゲーム", "ツール", "SNS", "教育", "健康", "ビジネス", "エンタメ", "その他"];

export default function IdeaBoardScreen() {
  const { isDark } = useTheme();
  const s = styles(isDark);
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sort, setSort] = useState<"created_at" | "wants">("wants");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    fetchIdeas();
  }, []);

  const fetchIdeas = useCallback(async () => {
    const { data: { user: currentUser } } = await supabase.auth.getUser();

    const { data } = await supabase
      .from("aa_ideas")
      .select("id, user_id, title, description, category, created_at")
      .order("created_at", { ascending: false });

    if (!data) { setLoading(false); setRefreshing(false); return; }

    const ideaIds = data.map((i: Idea) => i.id);
    const userIds = [...new Set(data.map((i: Idea) => i.user_id))];

    const [profilesRes, wantsRes, buildsRes] = await Promise.all([
      supabase.from("aa_profiles").select("id, username").in("id", userIds),
      supabase.from("aa_idea_wants").select("idea_id, user_id").in("idea_id", ideaIds),
      supabase.from("aa_idea_builds").select("idea_id").in("idea_id", ideaIds),
    ]);

    const profileMap: Record<string, string> = {};
    profilesRes.data?.forEach((p: { id: string; username: string }) => {
      profileMap[p.id] = p.username;
    });

    const wantsCount: Record<string, number> = {};
    const userWanted: Record<string, boolean> = {};
    wantsRes.data?.forEach((w: { idea_id: string; user_id: string }) => {
      wantsCount[w.idea_id] = (wantsCount[w.idea_id] ?? 0) + 1;
      if (currentUser && w.user_id === currentUser.id) {
        userWanted[w.idea_id] = true;
      }
    });

    const buildsCount: Record<string, number> = {};
    buildsRes.data?.forEach((b: { idea_id: string }) => {
      buildsCount[b.idea_id] = (buildsCount[b.idea_id] ?? 0) + 1;
    });

    let result: Idea[] = data.map((i: Idea) => ({
      ...i,
      username: profileMap[i.user_id] ?? "匿名",
      wants_count: wantsCount[i.id] ?? 0,
      builds_count: buildsCount[i.id] ?? 0,
      user_wanted: userWanted[i.id] ?? false,
    }));

    if (sort === "wants") {
      result = result.sort((a, b) => (b.wants_count ?? 0) - (a.wants_count ?? 0));
    }

    setIdeas(result);
    setLoading(false);
    setRefreshing(false);
  }, [sort]);

  useEffect(() => {
    setLoading(true);
    fetchIdeas();
  }, [sort]);

  const handleWant = async (idea: Idea) => {
    if (!user) { router.push("/auth"); return; }
    if (idea.user_wanted) {
      // 取り消し
      await supabase.from("aa_idea_wants").delete()
        .eq("idea_id", idea.id).eq("user_id", user.id);
      setIdeas((prev) => prev.map((i) =>
        i.id === idea.id
          ? { ...i, user_wanted: false, wants_count: (i.wants_count ?? 1) - 1 }
          : i
      ));
    } else {
      // 追加
      await supabase.from("aa_idea_wants").insert({ idea_id: idea.id, user_id: user.id });
      setIdeas((prev) => prev.map((i) =>
        i.id === idea.id
          ? { ...i, user_wanted: true, wants_count: (i.wants_count ?? 0) + 1 }
          : i
      ));
    }
  };

  const handleBuild = async (idea: Idea) => {
    if (!user) { router.push("/auth"); return; }
    Alert.alert(
      "作ります宣言",
      `「${idea.title}」を作ると宣言しますか？`,
      [
        { text: "キャンセル", style: "cancel" },
        {
          text: "宣言する", onPress: async () => {
            const { error } = await supabase.from("aa_idea_builds").insert({
              idea_id: idea.id,
              user_id: user.id,
            });
            if (!error) {
              setIdeas((prev) => prev.map((i) =>
                i.id === idea.id
                  ? { ...i, builds_count: (i.builds_count ?? 0) + 1 }
                  : i
              ));
              // 投稿者に通知
              const { data: myProfile } = await supabase
                .from("aa_profiles").select("username").eq("id", user.id).single();
              const myName = myProfile?.username ?? "開発者";
              if (idea.user_id !== user.id) {
                await supabase.from("aa_messages").insert({
                  user_id: idea.user_id,
                  title: "「作ります」宣言が来ました！",
                  body: `${myName}さんが「${idea.title}」を作ると宣言しました`,
                });
              }
            }
          }
        },
      ]
    );
  };

  const handleSubmit = async () => {
    if (!user) { router.push("/auth"); return; }
    if (!title.trim()) return;
    setSubmitting(true);
    const { data, error } = await supabase
      .from("aa_ideas")
      .insert({
        user_id: user.id,
        title: title.trim(),
        description: description.trim() || null,
        category: category || null,
      })
      .select("id, user_id, title, description, category, created_at")
      .single();

    if (data && !error) {
      const { data: profile } = await supabase
        .from("aa_profiles").select("username").eq("id", user.id).single();
      const newIdea: Idea = {
        ...data,
        username: profile?.username ?? "匿名",
        wants_count: 0,
        builds_count: 0,
        user_wanted: false,
      };
      setIdeas((prev) => [newIdea, ...prev]);
      setTitle("");
      setDescription("");
      setCategory("");
      setModalOpen(false);
    }
    setSubmitting(false);
  };

  const handleDelete = (ideaId: string, ideaUserId: string) => {
    if (!user || user.id !== ideaUserId) return;
    Alert.alert("削除", "このアイデアを削除しますか？", [
      { text: "キャンセル", style: "cancel" },
      {
        text: "削除", style: "destructive", onPress: async () => {
          await supabase.from("aa_ideas").delete().eq("id", ideaId).eq("user_id", user.id);
          setIdeas((prev) => prev.filter((i) => i.id !== ideaId));
        }
      },
    ]);
  };

  const renderItem = ({ item }: { item: Idea }) => (
    <View style={s.card}>
      <View style={s.cardHeader}>
        {item.category && (
          <View style={s.categoryBadge}>
            <Text style={s.categoryText}>{item.category}</Text>
          </View>
        )}
        <Text style={s.cardTitle}>{item.title}</Text>
      </View>
      {item.description ? (
        <Text style={s.cardDesc} numberOfLines={3}>{item.description}</Text>
      ) : null}
      <View style={s.cardMeta}>
        <Text style={s.metaText}>by {item.username}</Text>
        <Text style={s.metaText}>{new Date(item.created_at).toLocaleDateString("ja-JP")}</Text>
      </View>
      <View style={s.cardActions}>
        <TouchableOpacity
          style={[s.actionBtn, item.user_wanted && s.actionBtnActive]}
          onPress={() => handleWant(item)}
        >
          <Text style={[s.actionBtnText, item.user_wanted && s.actionBtnTextActive]}>
            {item.user_wanted ? "✓ 欲しい！" : "欲しい！"} {item.wants_count ?? 0}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.buildBtn} onPress={() => handleBuild(item)}>
          <Text style={s.buildBtnText}>🛠 作ります {item.builds_count ? `(${item.builds_count})` : ""}</Text>
        </TouchableOpacity>
        {user?.id === item.user_id && (
          <TouchableOpacity onPress={() => handleDelete(item.id, item.user_id)}>
            <Text style={s.deleteText}>削除</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  return (
    <View style={s.container}>
      {/* Sort + Post bar */}
      <View style={s.topBar}>
        <View style={s.sortRow}>
          {(["wants", "created_at"] as const).map((opt) => (
            <TouchableOpacity
              key={opt}
              style={[s.sortBtn, sort === opt && s.sortBtnActive]}
              onPress={() => setSort(opt)}
            >
              <Text style={[s.sortBtnText, sort === opt && s.sortBtnTextActive]}>
                {opt === "wants" ? "人気" : "新着"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        {user && (
          <TouchableOpacity style={s.postBtn} onPress={() => setModalOpen(true)}>
            <Text style={s.postBtnText}>＋ 投稿</Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={ideas}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchIdeas(); }} />}
        contentContainerStyle={{ padding: 12, gap: 10 }}
        ListEmptyComponent={
          !loading ? (
            <View style={s.empty}>
              <Text style={{ fontSize: 40 }}>💡</Text>
              <Text style={s.emptyTitle}>アイデアをリクエストしよう</Text>
              <Text style={s.emptyDesc}>「こんなアプリが欲しい！」を投稿すると{"\n"}開発者が作ってくれるかも</Text>
            </View>
          ) : null
        }
      />

      {/* 投稿モーダル */}
      <Modal visible={modalOpen} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView style={s.modal} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <ScrollView contentContainerStyle={{ padding: 20 }}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>アイデアを投稿</Text>
              <TouchableOpacity onPress={() => setModalOpen(false)}>
                <Text style={s.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={s.label}>タイトル *</Text>
            <TextInput
              style={s.input}
              value={title}
              onChangeText={setTitle}
              placeholder="例: 習慣化をゲームにしたアプリ"
              placeholderTextColor={isDark ? "#52525b" : "#a1a1aa"}
              maxLength={80}
            />

            <Text style={s.label}>詳しい説明（任意）</Text>
            <TextInput
              style={[s.input, { height: 100 }]}
              value={description}
              onChangeText={setDescription}
              placeholder="どんな機能が欲しい？どんな場面で使いたい？"
              placeholderTextColor={isDark ? "#52525b" : "#a1a1aa"}
              multiline
              maxLength={500}
            />

            <Text style={s.label}>カテゴリ（任意）</Text>
            <View style={s.categoryRow}>
              {CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[s.catChip, category === cat && s.catChipActive]}
                  onPress={() => setCategory(category === cat ? "" : cat)}
                >
                  <Text style={[s.catChipText, category === cat && s.catChipTextActive]}>{cat}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={[s.submitBtn, (!title.trim() || submitting) && { opacity: 0.4 }]}
              onPress={handleSubmit}
              disabled={!title.trim() || submitting}
            >
              <Text style={s.submitBtnText}>{submitting ? "投稿中..." : "投稿する"}</Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = (isDark: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: isDark ? "#09090b" : "#f4f4f5" },
  topBar: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 12, paddingVertical: 10,
    backgroundColor: isDark ? "#18181b" : "#ffffff",
    borderBottomWidth: 1, borderBottomColor: isDark ? "#27272a" : "#e4e4e7",
  },
  sortRow: { flexDirection: "row", gap: 8 },
  sortBtn: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8,
    borderWidth: 1, borderColor: isDark ? "#3f3f46" : "#e4e4e7",
  },
  sortBtnActive: { backgroundColor: isDark ? "#ffffff" : "#09090b", borderColor: "transparent" },
  sortBtnText: { fontSize: 13, fontWeight: "500", color: isDark ? "#a1a1aa" : "#71717a" },
  sortBtnTextActive: { color: isDark ? "#09090b" : "#ffffff" },
  postBtn: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8,
    backgroundColor: isDark ? "#ffffff" : "#09090b",
  },
  postBtnText: { fontSize: 13, fontWeight: "600", color: isDark ? "#09090b" : "#ffffff" },
  card: {
    backgroundColor: isDark ? "#18181b" : "#ffffff",
    borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: isDark ? "#27272a" : "#e4e4e7",
  },
  cardHeader: { marginBottom: 6 },
  categoryBadge: {
    alignSelf: "flex-start",
    backgroundColor: isDark ? "#27272a" : "#f4f4f5",
    borderRadius: 99, paddingHorizontal: 8, paddingVertical: 2,
    marginBottom: 6,
  },
  categoryText: { fontSize: 11, color: isDark ? "#a1a1aa" : "#71717a", fontWeight: "500" },
  cardTitle: { fontSize: 15, fontWeight: "700", color: isDark ? "#ffffff" : "#09090b" },
  cardDesc: { fontSize: 13, color: isDark ? "#a1a1aa" : "#71717a", marginBottom: 10, lineHeight: 19 },
  cardMeta: { flexDirection: "row", gap: 10, marginBottom: 10 },
  metaText: { fontSize: 11, color: isDark ? "#52525b" : "#a1a1aa" },
  cardActions: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  actionBtn: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8,
    borderWidth: 1.5, borderColor: isDark ? "#3f3f46" : "#e4e4e7",
  },
  actionBtnActive: {
    backgroundColor: isDark ? "#1c3a2a" : "#dcfce7",
    borderColor: isDark ? "#22c55e" : "#16a34a",
  },
  actionBtnText: { fontSize: 13, fontWeight: "600", color: isDark ? "#a1a1aa" : "#71717a" },
  actionBtnTextActive: { color: isDark ? "#22c55e" : "#16a34a" },
  buildBtn: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8,
    borderWidth: 1.5, borderColor: isDark ? "#3f3f46" : "#e4e4e7",
  },
  buildBtnText: { fontSize: 13, fontWeight: "600", color: isDark ? "#a1a1aa" : "#71717a" },
  deleteText: { fontSize: 11, color: isDark ? "#52525b" : "#a1a1aa" },
  empty: { alignItems: "center", marginTop: 80, gap: 10 },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: isDark ? "#ffffff" : "#09090b" },
  emptyDesc: { fontSize: 13, color: "#71717a", textAlign: "center", lineHeight: 20 },
  // Modal
  modal: { flex: 1, backgroundColor: isDark ? "#09090b" : "#ffffff" },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  modalTitle: { fontSize: 18, fontWeight: "700", color: isDark ? "#ffffff" : "#09090b" },
  modalClose: { fontSize: 20, color: isDark ? "#71717a" : "#a1a1aa" },
  label: { fontSize: 13, fontWeight: "600", color: isDark ? "#a1a1aa" : "#71717a", marginBottom: 6 },
  input: {
    borderWidth: 1, borderColor: isDark ? "#3f3f46" : "#e4e4e7",
    borderRadius: 10, padding: 12, fontSize: 14,
    color: isDark ? "#ffffff" : "#09090b",
    backgroundColor: isDark ? "#18181b" : "#f9f9f9",
    marginBottom: 16,
  },
  categoryRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 20 },
  catChip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 99,
    borderWidth: 1, borderColor: isDark ? "#3f3f46" : "#e4e4e7",
  },
  catChipActive: { backgroundColor: isDark ? "#ffffff" : "#09090b", borderColor: "transparent" },
  catChipText: { fontSize: 13, color: isDark ? "#a1a1aa" : "#71717a" },
  catChipTextActive: { color: isDark ? "#09090b" : "#ffffff", fontWeight: "600" },
  submitBtn: {
    backgroundColor: isDark ? "#ffffff" : "#09090b",
    borderRadius: 12, padding: 14, alignItems: "center",
  },
  submitBtnText: { fontSize: 15, fontWeight: "700", color: isDark ? "#09090b" : "#ffffff" },
});
