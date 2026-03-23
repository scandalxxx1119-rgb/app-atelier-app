import { useEffect, useState, useCallback } from "react";
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert, Image,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useTheme } from "@/lib/theme";

type Application = {
  id: string;
  user_id: string;
  status: string;
  message: string | null;
  created_at: string;
  username?: string;
  avatar_url?: string | null;
};

export default function TestersScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { isDark } = useTheme();
  const s = styles(isDark);
  const router = useRouter();

  const [appName, setAppName] = useState("");
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) { router.replace("/auth"); return; }

    const { data: app } = await supabase.from("aa_apps")
      .select("name, user_id").eq("id", id).single();

    if (!app || app.user_id !== auth.user.id) {
      Alert.alert("エラー", "権限がありません");
      router.back(); return;
    }
    setAppName(app.name);

    const { data: apps } = await supabase.from("aa_tester_applications")
      .select("*").eq("app_id", id).order("created_at", { ascending: false });

    if (!apps) { setLoading(false); return; }

    const userIds = [...new Set(apps.map((a: Application) => a.user_id))];
    const { data: profiles } = await supabase.from("aa_profiles")
      .select("id, username, avatar_url").in("id", userIds);

    const profileMap: Record<string, { username: string; avatar_url: string | null }> = {};
    profiles?.forEach((p: { id: string; username: string; avatar_url: string | null }) => {
      profileMap[p.id] = { username: p.username, avatar_url: p.avatar_url };
    });

    setApplications(apps.map((a: Application) => ({
      ...a,
      username: profileMap[a.user_id]?.username ?? "anonymous",
      avatar_url: profileMap[a.user_id]?.avatar_url ?? null,
    })));
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const handleApprove = async (appId: string) => {
    setProcessing(appId);
    await supabase.from("aa_tester_applications")
      .update({ status: "approved" }).eq("id", appId);
    setApplications((prev) => prev.map((a) => a.id === appId ? { ...a, status: "approved" } : a));
    setProcessing(null);
  };

  const handleComplete = (application: Application) => {
    Alert.alert(
      "テスター完了",
      `${application.username}のテストを完了にしますか？\n完了するとテスターに2ptが付与されます。`,
      [
        { text: "キャンセル", style: "cancel" },
        {
          text: "完了にする",
          onPress: async () => {
            setProcessing(application.id);
            await supabase.from("aa_tester_applications")
              .update({ status: "completed" }).eq("id", application.id);
            await supabase.from("aa_points").insert({
              user_id: application.user_id,
              amount: 2,
              reason: `「${appName}」のテスター完了`,
              app_id: id,
            });
            setApplications((prev) =>
              prev.map((a) => a.id === application.id ? { ...a, status: "completed" } : a)
            );
            setProcessing(null);
          },
        },
      ]
    );
  };

  const statusInfo = (status: string) => {
    if (status === "pending") return { label: "申請中", bg: isDark ? "#451a03" : "#fef3c7", text: isDark ? "#fcd34d" : "#d97706" };
    if (status === "approved") return { label: "承認済み", bg: isDark ? "#1e3a5f" : "#dbeafe", text: isDark ? "#93c5fd" : "#2563eb" };
    return { label: "完了", bg: isDark ? "#14532d" : "#dcfce7", text: isDark ? "#86efac" : "#16a34a" };
  };

  const renderSection = (title: string, items: Application[]) => {
    if (items.length === 0) return null;
    return (
      <View style={{ marginBottom: 24 }}>
        <Text style={s.sectionTitle}>{title}（{items.length}）</Text>
        {items.map((app) => {
          const si = statusInfo(app.status);
          return (
            <View key={app.id} style={s.card}>
              <View style={s.cardRow}>
                {app.avatar_url ? (
                  <Image source={{ uri: app.avatar_url }} style={s.avatar} />
                ) : (
                  <View style={s.avatarPlaceholder}>
                    <Text style={s.avatarText}>{(app.username ?? "?")[0].toUpperCase()}</Text>
                  </View>
                )}
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <Text style={s.username}>{app.username}</Text>
                    <View style={[s.statusBadge, { backgroundColor: si.bg }]}>
                      <Text style={[s.statusText, { color: si.text }]}>{si.label}</Text>
                    </View>
                  </View>
                  {app.message ? (
                    <Text style={s.message} numberOfLines={2}>{app.message}</Text>
                  ) : null}
                </View>
              </View>
              {app.status === "pending" && (
                <TouchableOpacity
                  style={[s.approveBtn, processing === app.id && { opacity: 0.5 }]}
                  onPress={() => handleApprove(app.id)}
                  disabled={processing === app.id}
                >
                  <Text style={s.approveBtnText}>承認する</Text>
                </TouchableOpacity>
              )}
              {app.status === "approved" && (
                <TouchableOpacity
                  style={[s.completeBtn, processing === app.id && { opacity: 0.5 }]}
                  onPress={() => handleComplete(app)}
                  disabled={processing === app.id}
                >
                  <Text style={s.completeBtnText}>✓ テスト完了（+2pt）</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })}
      </View>
    );
  };

  if (loading) return <ActivityIndicator style={{ flex: 1 }} />;

  const pending = applications.filter((a) => a.status === "pending");
  const approved = applications.filter((a) => a.status === "approved");
  const completed = applications.filter((a) => a.status === "completed");

  return (
    <ScrollView style={s.container} contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>
      <Text style={s.title}>テスター管理</Text>
      <Text style={s.subtitle}>{appName}</Text>
      {applications.length === 0 ? (
        <Text style={s.empty}>まだ申請がありません</Text>
      ) : (
        <>
          {renderSection("申請中", pending)}
          {renderSection("承認済み", approved)}
          {renderSection("完了", completed)}
        </>
      )}
    </ScrollView>
  );
}

const styles = (isDark: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: isDark ? "#09090b" : "#f4f4f5" },
  title: { fontSize: 22, fontWeight: "700", color: isDark ? "#ffffff" : "#09090b", marginBottom: 4 },
  subtitle: { fontSize: 14, color: isDark ? "#71717a" : "#a1a1aa", marginBottom: 24 },
  sectionTitle: { fontSize: 12, fontWeight: "700", color: isDark ? "#71717a" : "#a1a1aa", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12 },
  card: { backgroundColor: isDark ? "#18181b" : "#ffffff", borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: isDark ? "#27272a" : "#e4e4e7" },
  cardRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: 10 },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  avatarPlaceholder: { width: 40, height: 40, borderRadius: 20, backgroundColor: isDark ? "#27272a" : "#e4e4e7", alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 16, fontWeight: "700", color: isDark ? "#71717a" : "#a1a1aa" },
  username: { fontSize: 14, fontWeight: "600", color: isDark ? "#ffffff" : "#09090b" },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 99 },
  statusText: { fontSize: 11, fontWeight: "600" },
  message: { fontSize: 12, color: isDark ? "#a1a1aa" : "#71717a", marginTop: 4 },
  approveBtn: { backgroundColor: "#2563eb", paddingVertical: 10, borderRadius: 8, alignItems: "center" },
  approveBtnText: { color: "#ffffff", fontSize: 13, fontWeight: "600" },
  completeBtn: { backgroundColor: isDark ? "#052e16" : "#dcfce7", paddingVertical: 10, borderRadius: 8, alignItems: "center", borderWidth: 1, borderColor: isDark ? "#16a34a" : "#86efac" },
  completeBtnText: { color: isDark ? "#86efac" : "#16a34a", fontSize: 13, fontWeight: "600" },
  empty: { fontSize: 14, color: isDark ? "#71717a" : "#a1a1aa", textAlign: "center", marginTop: 60 },
});
