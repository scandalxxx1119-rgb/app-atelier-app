import { useEffect, useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, useColorScheme, Image, Alert, ActivityIndicator,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";
import { PLATFORM_TAGS, CATEGORY_TAGS, SPECIAL_TAGS } from "@/lib/tags";
import { isPremiumBadge } from "@/components/Badge";
import type { User } from "@supabase/supabase-js";

const STATUS_OPTIONS = [
  { value: "released", label: "✓ リリース済み" },
  { value: "beta", label: "β ベータ版" },
  { value: "dev", label: "🚧 開発中" },
];

async function uploadImage(uri: string, path: string): Promise<string> {
  const response = await fetch(uri);
  const blob = await response.blob();
  const ext = uri.split(".").pop()?.split("?")[0] ?? "jpg";
  const { error } = await supabase.storage.from("aa-apps").upload(path, blob, {
    contentType: `image/${ext === "jpg" ? "jpeg" : ext}`,
    upsert: true,
  });
  if (error) throw error;
  const { data } = supabase.storage.from("aa-apps").getPublicUrl(path);
  return data.publicUrl;
}

export default function SubmitScreen() {
  const isDark = useColorScheme() === "dark";
  const s = styles(isDark);
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [isPremium, setIsPremium] = useState(false);
  const [submitting, setSubmitting] = useState(false);

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
  const [testerSlots, setTesterSlots] = useState("");
  const [testerPoints, setTesterPoints] = useState("10");

  const [iconUri, setIconUri] = useState<string | null>(null);
  const [screenshots, setScreenshots] = useState<string[]>([]);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { router.replace("/auth"); return; }
      setUser(data.user);
      const { data: profile } = await supabase.from("aa_profiles")
        .select("badge, is_premium").eq("id", data.user.id).single();
      setIsPremium(isPremiumBadge(profile?.badge) || profile?.is_premium === true);
    });
  }, []);

  const maxScreenshots = isPremium ? 10 : 5;

  const pickIcon = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, aspect: [1, 1], quality: 0.8,
    });
    if (!result.canceled) setIconUri(result.assets[0].uri);
  };

  const pickScreenshots = async () => {
    if (screenshots.length >= maxScreenshots) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true, quality: 0.8,
    });
    if (!result.canceled) {
      const newUris = result.assets.map((a) => a.uri);
      setScreenshots((prev) => [...prev, ...newUris].slice(0, maxScreenshots));
    }
  };

  const toggleTag = (tag: string) =>
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );

  const handleSubmit = async () => {
    if (!user || !name.trim() || !tagline.trim()) {
      Alert.alert("入力エラー", "アプリ名とキャッチコピーは必須です");
      return;
    }
    setSubmitting(true);
    try {
      let iconUrl: string | null = null;
      if (iconUri) {
        iconUrl = await uploadImage(iconUri, `${user.id}/icons/${Date.now()}.jpg`);
      }
      const screenshotUrls: string[] = [];
      for (const uri of screenshots) {
        const uploaded = await uploadImage(
          uri, `${user.id}/screenshots/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`
        );
        screenshotUrls.push(uploaded);
      }
      const { error } = await supabase.from("aa_apps").insert({
        user_id: user.id,
        name: name.trim(),
        tagline: tagline.trim(),
        description: description.trim() || null,
        url: url.trim() || null,
        app_store_url: appStoreUrl.trim() || null,
        play_store_url: playStoreUrl.trim() || null,
        github_url: githubUrl.trim() || null,
        twitter_url: twitterUrl.trim() || null,
        youtube_url: youtubeUrl.trim() || null,
        icon_url: iconUrl,
        screenshot_urls: screenshotUrls.length > 0 ? screenshotUrls : null,
        tags: selectedTags.length > 0 ? selectedTags : null,
        status,
        tester_slots: testerSlots ? parseInt(testerSlots) : 0,
        tester_reward_points: testerPoints ? parseInt(testerPoints) : 10,
      });
      if (error) throw error;
      Alert.alert("投稿完了", "アプリを投稿しました！", [
        { text: "OK", onPress: () => router.replace("/(tabs)") },
      ]);
    } catch (err: unknown) {
      Alert.alert("エラー", err instanceof Error ? err.message : "投稿に失敗しました");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView style={s.container} contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>
      {/* Icon */}
      <Text style={s.label}>アイコン</Text>
      <TouchableOpacity onPress={pickIcon} style={s.iconPicker}>
        {iconUri ? (
          <Image source={{ uri: iconUri }} style={{ width: 80, height: 80, borderRadius: 18 }} />
        ) : (
          <Text style={{ fontSize: 32, color: isDark ? "#52525b" : "#d4d4d8" }}>+</Text>
        )}
      </TouchableOpacity>

      {/* Status */}
      <Text style={s.label}>ステータス</Text>
      <View style={s.row}>
        {STATUS_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.value}
            onPress={() => setStatus(opt.value)}
            style={[s.optBtn, status === opt.value && s.optBtnActive]}
          >
            <Text style={[s.optBtnText, status === opt.value && s.optBtnTextActive]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Basic */}
      <Text style={s.label}>アプリ名 *</Text>
      <TextInput style={s.input} value={name} onChangeText={setName} placeholder="My Awesome App" placeholderTextColor={isDark ? "#52525b" : "#a1a1aa"} maxLength={50} />

      <Text style={s.label}>キャッチコピー *</Text>
      <TextInput style={s.input} value={tagline} onChangeText={setTagline} placeholder="一言でアプリを説明" placeholderTextColor={isDark ? "#52525b" : "#a1a1aa"} maxLength={100} />

      <Text style={s.label}>説明</Text>
      <TextInput style={[s.input, { height: 100, textAlignVertical: "top" }]} value={description} onChangeText={setDescription} placeholder="アプリの詳細説明..." placeholderTextColor={isDark ? "#52525b" : "#a1a1aa"} multiline />

      {/* Screenshots */}
      <Text style={s.label}>スクリーンショット（最大{maxScreenshots}枚）</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {screenshots.map((uri, i) => (
            <View key={i} style={{ position: "relative" }}>
              <Image source={{ uri }} style={{ width: 80, height: 56, borderRadius: 8 }} />
              <TouchableOpacity
                onPress={() => setScreenshots((prev) => prev.filter((_, idx) => idx !== i))}
                style={s.removeBtn}
              >
                <Text style={{ color: "#fff", fontSize: 10, fontWeight: "700" }}>×</Text>
              </TouchableOpacity>
            </View>
          ))}
          {screenshots.length < maxScreenshots && (
            <TouchableOpacity onPress={pickScreenshots} style={s.addSsBtn}>
              <Text style={{ color: isDark ? "#52525b" : "#d4d4d8", fontSize: 24 }}>+</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      {/* Tags */}
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

      {/* Store links */}
      <Text style={s.sectionTitle}>ストアリンク</Text>
      <TextInput style={s.input} value={appStoreUrl} onChangeText={setAppStoreUrl} placeholder="🍎 App Store URL" placeholderTextColor={isDark ? "#52525b" : "#a1a1aa"} autoCapitalize="none" keyboardType="url" />
      <View style={{ height: 8 }} />
      <TextInput style={s.input} value={playStoreUrl} onChangeText={setPlayStoreUrl} placeholder="▶ Google Play URL" placeholderTextColor={isDark ? "#52525b" : "#a1a1aa"} autoCapitalize="none" keyboardType="url" />
      <View style={{ height: 8 }} />
      <TextInput style={s.input} value={url} onChangeText={setUrl} placeholder="🌐 Web サイト URL" placeholderTextColor={isDark ? "#52525b" : "#a1a1aa"} autoCapitalize="none" keyboardType="url" />

      {/* Social links */}
      <Text style={s.sectionTitle}>SNS・開発リンク</Text>
      <TextInput style={s.input} value={twitterUrl} onChangeText={setTwitterUrl} placeholder="𝕏 https://x.com/..." placeholderTextColor={isDark ? "#52525b" : "#a1a1aa"} autoCapitalize="none" keyboardType="url" />
      <View style={{ height: 8 }} />
      <TextInput style={s.input} value={youtubeUrl} onChangeText={setYoutubeUrl} placeholder="📺 YouTube URL" placeholderTextColor={isDark ? "#52525b" : "#a1a1aa"} autoCapitalize="none" keyboardType="url" />
      <View style={{ height: 8 }} />
      <TextInput style={s.input} value={githubUrl} onChangeText={setGithubUrl} placeholder="🐙 GitHub URL" placeholderTextColor={isDark ? "#52525b" : "#a1a1aa"} autoCapitalize="none" keyboardType="url" />

      {/* Tester */}
      <Text style={s.sectionTitle}>テスター募集（任意）</Text>
      <TextInput style={s.input} value={testerSlots} onChangeText={setTesterSlots} placeholder="募集人数（0で募集なし）" placeholderTextColor={isDark ? "#52525b" : "#a1a1aa"} keyboardType="numeric" />
      <View style={{ height: 8 }} />
      <TextInput style={s.input} value={testerPoints} onChangeText={setTesterPoints} placeholder="参加ポイント報酬（デフォルト10pt）" placeholderTextColor={isDark ? "#52525b" : "#a1a1aa"} keyboardType="numeric" />

      {/* Submit */}
      <TouchableOpacity style={s.submitBtn} onPress={handleSubmit} disabled={submitting}>
        {submitting ? (
          <ActivityIndicator color={isDark ? "#09090b" : "#ffffff"} />
        ) : (
          <Text style={s.submitBtnText}>投稿する</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = (isDark: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: isDark ? "#09090b" : "#f4f4f5" },
  label: { fontSize: 13, fontWeight: "600", color: isDark ? "#ffffff" : "#09090b", marginBottom: 8, marginTop: 16 },
  sectionTitle: { fontSize: 14, fontWeight: "700", color: isDark ? "#ffffff" : "#09090b", marginTop: 24, marginBottom: 10, borderTopWidth: 1, borderTopColor: isDark ? "#27272a" : "#e4e4e7", paddingTop: 16 },
  input: {
    backgroundColor: isDark ? "#18181b" : "#ffffff",
    borderWidth: 1, borderColor: isDark ? "#3f3f46" : "#e4e4e7",
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 14, color: isDark ? "#ffffff" : "#09090b",
  },
  iconPicker: {
    width: 88, height: 88, borderRadius: 20,
    borderWidth: 2, borderColor: isDark ? "#3f3f46" : "#e4e4e7",
    borderStyle: "dashed", alignItems: "center", justifyContent: "center",
    marginBottom: 4,
  },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  optBtn: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8,
    borderWidth: 1, borderColor: isDark ? "#3f3f46" : "#e4e4e7",
  },
  optBtnActive: { backgroundColor: isDark ? "#ffffff" : "#09090b", borderColor: "transparent" },
  optBtnText: { fontSize: 13, fontWeight: "500", color: isDark ? "#a1a1aa" : "#71717a" },
  optBtnTextActive: { color: isDark ? "#09090b" : "#ffffff" },
  tagsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 4 },
  tagBtn: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 99,
    backgroundColor: isDark ? "#27272a" : "#f4f4f5",
  },
  tagBtnActive: { backgroundColor: isDark ? "#ffffff" : "#09090b" },
  tagBtnText: { fontSize: 12, color: isDark ? "#a1a1aa" : "#71717a", fontWeight: "500" },
  tagBtnTextActive: { color: isDark ? "#09090b" : "#ffffff" },
  addSsBtn: {
    width: 80, height: 56, borderRadius: 8,
    borderWidth: 2, borderColor: isDark ? "#3f3f46" : "#e4e4e7",
    borderStyle: "dashed", alignItems: "center", justifyContent: "center",
  },
  removeBtn: {
    position: "absolute", top: -6, right: -6,
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: "#18181b", alignItems: "center", justifyContent: "center",
  },
  submitBtn: {
    marginTop: 32, backgroundColor: isDark ? "#ffffff" : "#09090b",
    borderRadius: 12, paddingVertical: 16, alignItems: "center",
  },
  submitBtnText: { color: isDark ? "#09090b" : "#ffffff", fontSize: 16, fontWeight: "700" },
});
