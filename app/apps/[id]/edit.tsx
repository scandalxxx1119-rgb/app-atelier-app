import { useEffect, useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Image, Alert, ActivityIndicator,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useTheme } from "@/lib/theme";
import { PLATFORM_TAGS, CATEGORY_TAGS, SPECIAL_TAGS } from "@/lib/tags";
import { isPremiumBadge } from "@/components/Badge";

const STATUS_OPTIONS = [
  { value: "released", label: "✓ リリース済み" },
  { value: "beta", label: "β ベータ版" },
  { value: "dev", label: "🚧 開発中" },
];

async function uploadImage(uri: string, path: string): Promise<string> {
  const response = await fetch(uri);
  const blob = await response.blob();
  const ext = uri.split(".").pop()?.split("?")[0] ?? "jpg";
  await supabase.storage.from("aa-apps").upload(path, blob, {
    contentType: `image/${ext === "jpg" ? "jpeg" : ext}`, upsert: true,
  });
  const { data } = supabase.storage.from("aa-apps").getPublicUrl(path);
  return data.publicUrl;
}

export default function EditScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { isDark } = useTheme();
  const s = styles(isDark);
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isPremium, setIsPremium] = useState(false);

  const [name, setName] = useState("");
  const [tagline, setTagline] = useState("");
  const [description, setDescription] = useState("");
  const [url, setUrl] = useState("");
  const [appStoreUrl, setAppStoreUrl] = useState("");
  const [playStoreUrl, setPlayStoreUrl] = useState("");
  const [githubUrl, setGithubUrl] = useState("");
  const [twitterUrl, setTwitterUrl] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [status, setStatus] = useState("released");
  const [testerSlots, setTesterSlots] = useState("0");
  const [testerPoints, setTesterPoints] = useState("10");
  const [iconUrl, setIconUrl] = useState<string | null>(null);
  const [iconUri, setIconUri] = useState<string | null>(null);
  const [existingScreenshots, setExistingScreenshots] = useState<string[]>([]);
  const [newScreenshotUris, setNewScreenshotUris] = useState<string[]>([]);

  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) { router.replace("/auth"); return; }

      const [appRes, profileRes] = await Promise.all([
        supabase.from("aa_apps").select("*").eq("id", id).single(),
        supabase.from("aa_profiles").select("badge, is_premium, screenshot_extended").eq("id", auth.user.id).single(),
      ]);

      if (!appRes.data || appRes.data.user_id !== auth.user.id) {
        Alert.alert("エラー", "このアプリを編集する権限がありません");
        router.back(); return;
      }

      const app = appRes.data;
      setName(app.name ?? "");
      setTagline(app.tagline ?? "");
      setDescription(app.description ?? "");
      setUrl(app.url ?? "");
      setAppStoreUrl(app.app_store_url ?? "");
      setPlayStoreUrl(app.play_store_url ?? "");
      setGithubUrl(app.github_url ?? "");
      setTwitterUrl(app.twitter_url ?? "");
      setYoutubeUrl(app.youtube_url ?? "");
      setSelectedTags(app.tags ?? []);
      setStatus(app.status ?? "released");
      setTesterSlots(String(app.tester_slots ?? 0));
      setTesterPoints(String(app.tester_reward_points ?? 10));
      setIconUrl(app.icon_url ?? null);
      setExistingScreenshots(app.screenshot_urls ?? []);
      setIsPremium(isPremiumBadge(profileRes.data?.badge) || profileRes.data?.is_premium === true || profileRes.data?.screenshot_extended === true);
      setLoading(false);
    })();
  }, [id]);

  const maxScreenshots = isPremium ? 10 : 5;
  const totalScreenshots = existingScreenshots.length + newScreenshotUris.length;

  const pickIcon = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, aspect: [1, 1], quality: 0.8,
    });
    if (!result.canceled) setIconUri(result.assets[0].uri);
  };

  const pickScreenshots = async () => {
    if (totalScreenshots >= maxScreenshots) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true, quality: 0.8,
    });
    if (!result.canceled) {
      const newUris = result.assets.map((a) => a.uri);
      setNewScreenshotUris((prev) => [...prev, ...newUris].slice(0, maxScreenshots - existingScreenshots.length));
    }
  };

  const toggleTag = (tag: string) =>
    setSelectedTags((prev) => prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]);

  const handleSave = async () => {
    if (!name.trim() || !tagline.trim()) {
      Alert.alert("入力エラー", "アプリ名とキャッチコピーは必須です"); return;
    }
    setSaving(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      let finalIconUrl = iconUrl;
      if (iconUri) {
        finalIconUrl = await uploadImage(iconUri, `${auth.user!.id}/icons/${Date.now()}.jpg`);
      }
      const newUrls: string[] = [];
      for (const uri of newScreenshotUris) {
        const uploaded = await uploadImage(uri, `${auth.user!.id}/screenshots/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`);
        newUrls.push(uploaded);
      }
      const allScreenshots = [...existingScreenshots, ...newUrls];

      await supabase.from("aa_apps").update({
        name: name.trim(), tagline: tagline.trim(), description: description.trim() || null,
        url: url.trim() || null, app_store_url: appStoreUrl.trim() || null,
        play_store_url: playStoreUrl.trim() || null, github_url: githubUrl.trim() || null,
        twitter_url: twitterUrl.trim() || null, youtube_url: youtubeUrl.trim() || null,
        icon_url: finalIconUrl, screenshot_urls: allScreenshots.length > 0 ? allScreenshots : null,
        tags: selectedTags.length > 0 ? selectedTags : null, status,
        tester_slots: parseInt(testerSlots) || 0,
        tester_reward_points: parseInt(testerPoints) || 10,
      }).eq("id", id);

      Alert.alert("保存完了", "アプリを更新しました", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (err: unknown) {
      Alert.alert("エラー", err instanceof Error ? err.message : "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <ActivityIndicator style={{ flex: 1 }} />;

  return (
    <ScrollView style={s.container} contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>
      <Text style={s.label}>アイコン</Text>
      <TouchableOpacity onPress={pickIcon} style={s.iconPicker}>
        {iconUri ? (
          <Image source={{ uri: iconUri }} style={{ width: 80, height: 80, borderRadius: 18 }} />
        ) : iconUrl ? (
          <Image source={{ uri: iconUrl }} style={{ width: 80, height: 80, borderRadius: 18 }} />
        ) : (
          <Text style={{ fontSize: 32, color: isDark ? "#52525b" : "#d4d4d8" }}>+</Text>
        )}
      </TouchableOpacity>

      <Text style={s.label}>ステータス</Text>
      <View style={s.row}>
        {STATUS_OPTIONS.map((opt) => (
          <TouchableOpacity key={opt.value} onPress={() => setStatus(opt.value)} style={[s.optBtn, status === opt.value && s.optBtnActive]}>
            <Text style={[s.optBtnText, status === opt.value && s.optBtnTextActive]}>{opt.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={s.label}>アプリ名 *</Text>
      <TextInput style={s.input} value={name} onChangeText={setName} maxLength={50} placeholderTextColor={isDark ? "#52525b" : "#a1a1aa"} />
      <Text style={s.label}>キャッチコピー *</Text>
      <TextInput style={s.input} value={tagline} onChangeText={setTagline} maxLength={100} placeholderTextColor={isDark ? "#52525b" : "#a1a1aa"} />
      <Text style={s.label}>説明</Text>
      <TextInput style={[s.input, { height: 100, textAlignVertical: "top" }]} value={description} onChangeText={setDescription} multiline placeholderTextColor={isDark ? "#52525b" : "#a1a1aa"} />

      <Text style={s.label}>スクリーンショット（最大{maxScreenshots}枚）</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {existingScreenshots.map((uri, i) => (
            <View key={`ex-${i}`} style={{ position: "relative" }}>
              <Image source={{ uri }} style={{ width: 80, height: 56, borderRadius: 8 }} />
              <TouchableOpacity
                onPress={() => setExistingScreenshots((prev) => prev.filter((_, idx) => idx !== i))}
                style={s.removeBtn}
              >
                <Text style={{ color: "#fff", fontSize: 10, fontWeight: "700" }}>×</Text>
              </TouchableOpacity>
            </View>
          ))}
          {newScreenshotUris.map((uri, i) => (
            <View key={`new-${i}`} style={{ position: "relative" }}>
              <Image source={{ uri }} style={{ width: 80, height: 56, borderRadius: 8 }} />
              <TouchableOpacity
                onPress={() => setNewScreenshotUris((prev) => prev.filter((_, idx) => idx !== i))}
                style={s.removeBtn}
              >
                <Text style={{ color: "#fff", fontSize: 10, fontWeight: "700" }}>×</Text>
              </TouchableOpacity>
            </View>
          ))}
          {totalScreenshots < maxScreenshots && (
            <TouchableOpacity onPress={pickScreenshots} style={s.addSsBtn}>
              <Text style={{ color: isDark ? "#52525b" : "#d4d4d8", fontSize: 24 }}>+</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      <Text style={s.label}>タグ（特別）</Text>
      <View style={s.tagsWrap}>
        {SPECIAL_TAGS.map((tag) => (
          <TouchableOpacity key={tag} onPress={() => toggleTag(tag)} style={[s.tagBtn, selectedTags.includes(tag) && s.tagBtnActive]}>
            <Text style={[s.tagBtnText, selectedTags.includes(tag) && s.tagBtnTextActive]}>{tag}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <Text style={s.label}>プラットフォーム</Text>
      <View style={s.tagsWrap}>
        {PLATFORM_TAGS.map((tag) => (
          <TouchableOpacity key={tag} onPress={() => toggleTag(tag)} style={[s.tagBtn, selectedTags.includes(tag) && s.tagBtnActive]}>
            <Text style={[s.tagBtnText, selectedTags.includes(tag) && s.tagBtnTextActive]}>{tag}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <Text style={s.label}>カテゴリ</Text>
      <View style={s.tagsWrap}>
        {CATEGORY_TAGS.map((tag) => (
          <TouchableOpacity key={tag} onPress={() => toggleTag(tag)} style={[s.tagBtn, selectedTags.includes(tag) && s.tagBtnActive]}>
            <Text style={[s.tagBtnText, selectedTags.includes(tag) && s.tagBtnTextActive]}>{tag}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={s.sectionTitle}>ストアリンク</Text>
      <TextInput style={s.input} value={appStoreUrl} onChangeText={setAppStoreUrl} placeholder="🍎 App Store URL" placeholderTextColor={isDark ? "#52525b" : "#a1a1aa"} autoCapitalize="none" keyboardType="url" />
      <View style={{ height: 8 }} />
      <TextInput style={s.input} value={playStoreUrl} onChangeText={setPlayStoreUrl} placeholder="▶ Google Play URL" placeholderTextColor={isDark ? "#52525b" : "#a1a1aa"} autoCapitalize="none" keyboardType="url" />
      <View style={{ height: 8 }} />
      <TextInput style={s.input} value={url} onChangeText={setUrl} placeholder="🌐 Web URL" placeholderTextColor={isDark ? "#52525b" : "#a1a1aa"} autoCapitalize="none" keyboardType="url" />

      <Text style={s.sectionTitle}>SNS・開発リンク</Text>
      <TextInput style={s.input} value={twitterUrl} onChangeText={setTwitterUrl} placeholder="𝕏 Twitter URL" placeholderTextColor={isDark ? "#52525b" : "#a1a1aa"} autoCapitalize="none" keyboardType="url" />
      <View style={{ height: 8 }} />
      <TextInput style={s.input} value={youtubeUrl} onChangeText={setYoutubeUrl} placeholder="📺 YouTube URL" placeholderTextColor={isDark ? "#52525b" : "#a1a1aa"} autoCapitalize="none" keyboardType="url" />
      <View style={{ height: 8 }} />
      <TextInput style={s.input} value={githubUrl} onChangeText={setGithubUrl} placeholder="🐙 GitHub URL" placeholderTextColor={isDark ? "#52525b" : "#a1a1aa"} autoCapitalize="none" keyboardType="url" />

      <Text style={s.sectionTitle}>テスター募集</Text>
      <TextInput style={s.input} value={testerSlots} onChangeText={setTesterSlots} placeholder="募集人数（0で募集なし）" placeholderTextColor={isDark ? "#52525b" : "#a1a1aa"} keyboardType="numeric" />
      <View style={{ height: 8 }} />
      <TextInput style={s.input} value={testerPoints} onChangeText={setTesterPoints} placeholder="参加ポイント報酬" placeholderTextColor={isDark ? "#52525b" : "#a1a1aa"} keyboardType="numeric" />

      <TouchableOpacity style={s.submitBtn} onPress={handleSave} disabled={saving}>
        {saving ? <ActivityIndicator color={isDark ? "#09090b" : "#ffffff"} /> : <Text style={s.submitBtnText}>保存する</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = (isDark: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: isDark ? "#09090b" : "#f4f4f5" },
  label: { fontSize: 13, fontWeight: "600", color: isDark ? "#ffffff" : "#09090b", marginBottom: 8, marginTop: 16 },
  sectionTitle: { fontSize: 14, fontWeight: "700", color: isDark ? "#ffffff" : "#09090b", marginTop: 24, marginBottom: 10, borderTopWidth: 1, borderTopColor: isDark ? "#27272a" : "#e4e4e7", paddingTop: 16 },
  input: { backgroundColor: isDark ? "#18181b" : "#ffffff", borderWidth: 1, borderColor: isDark ? "#3f3f46" : "#e4e4e7", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: isDark ? "#ffffff" : "#09090b" },
  iconPicker: { width: 88, height: 88, borderRadius: 20, borderWidth: 2, borderColor: isDark ? "#3f3f46" : "#e4e4e7", borderStyle: "dashed", alignItems: "center", justifyContent: "center", marginBottom: 4 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  optBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: isDark ? "#3f3f46" : "#e4e4e7" },
  optBtnActive: { backgroundColor: isDark ? "#ffffff" : "#09090b", borderColor: "transparent" },
  optBtnText: { fontSize: 13, fontWeight: "500", color: isDark ? "#a1a1aa" : "#71717a" },
  optBtnTextActive: { color: isDark ? "#09090b" : "#ffffff" },
  tagsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 4 },
  tagBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 99, backgroundColor: isDark ? "#27272a" : "#f4f4f5" },
  tagBtnActive: { backgroundColor: isDark ? "#ffffff" : "#09090b" },
  tagBtnText: { fontSize: 12, color: isDark ? "#a1a1aa" : "#71717a", fontWeight: "500" },
  tagBtnTextActive: { color: isDark ? "#09090b" : "#ffffff" },
  addSsBtn: { width: 80, height: 56, borderRadius: 8, borderWidth: 2, borderColor: isDark ? "#3f3f46" : "#e4e4e7", borderStyle: "dashed", alignItems: "center", justifyContent: "center" },
  removeBtn: { position: "absolute", top: -6, right: -6, width: 18, height: 18, borderRadius: 9, backgroundColor: "#18181b", alignItems: "center", justifyContent: "center" },
  submitBtn: { marginTop: 32, backgroundColor: isDark ? "#ffffff" : "#09090b", borderRadius: 12, paddingVertical: 16, alignItems: "center" },
  submitBtnText: { color: isDark ? "#09090b" : "#ffffff", fontSize: 16, fontWeight: "700" },
});
