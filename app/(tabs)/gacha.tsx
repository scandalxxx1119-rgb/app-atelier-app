import { useEffect, useState, useRef } from "react";
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, Image, Alert, Animated,
} from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useTheme } from "@/lib/theme";

const WEB_API = "https://appatelier.dev/api/gacha";

const GACHA_INFO = [
  { type: "normal",  name: "ノーマルガチャ",   cost: 30,  description: "プロフィールカラー（全20色）", icon: "🎨" },
  { type: "super",   name: "スーパーガチャ",   cost: 100, description: "プロフィールバッジ（レアリティあり）", icon: "✨" },
  { type: "premium", name: "プレミアムガチャ", cost: 300, description: "アプリアイコンカード（1〜100番目限定）", icon: "👑" },
];

const RARITY_COLOR: Record<string, string> = {
  common: "#71717a", rare: "#3b82f6", epic: "#a855f7", legendary: "#eab308", unique: "#22c55e",
};
const RARITY_LABEL: Record<string, string> = {
  common: "COMMON", rare: "RARE ⭐", epic: "EPIC ✨", legendary: "LEGENDARY 🌟", unique: "UNIQUE 💎",
};

const COLOR_CATEGORY_META: Record<string, { label: string; desc: string; icon: string }> = {
  color_text:   { label: "文字色",     desc: "ユーザー名・テキストに反映",     icon: "✏️" },
  color_avatar: { label: "アバター枠色", desc: "アバター画像の枠の色に反映",    icon: "🖼️" },
  color_card:   { label: "カードカラー", desc: "アプリカードのアクセントに反映", icon: "🃏" },
};

const SLOT_SYMBOLS = ["🎨", "✨", "👑", "🎰", "💎", "⭐", "🌈", "🍀", "🔥", "💫", "🎯", "🃏"];

type GachaItem = {
  id: string; gacha_type: string; category: string;
  name: string; value: string; icon_url?: string; rarity: string;
};
type InventoryItem = {
  id: string; item_id: string | null; app_id: string | null; obtained_at: string;
  aa_gacha_items?: GachaItem;
  aa_apps?: { id: string; name: string; icon_url: string };
};

export default function GachaScreen() {
  const { isDark } = useTheme();
  const s = styles(isDark);
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [points, setPoints] = useState(0);
  const [pulling, setPulling] = useState<string | null>(null);
  const [result, setResult] = useState<GachaItem | null>(null);
  const [resultType, setResultType] = useState<string | null>(null);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [tab, setTab] = useState<"gacha" | "inventory">("gacha");

  // 3種類のカラー設定
  const [textColor, setTextColor] = useState<string | null>(null);
  const [avatarBorderColor, setAvatarBorderColor] = useState<string | null>(null);
  const [cardColor, setCardColor] = useState<string | null>(null);
  const [gachaBadge, setGachaBadge] = useState<string | null>(null);

  // アニメーション
  const [slotSymbols, setSlotSymbols] = useState(["🎨", "✨", "👑"]);
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const resultScale = useRef(new Animated.Value(0.7)).current;
  const resultOpacity = useRef(new Animated.Value(0)).current;
  const pulseLoop = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => { init(); }, []);

  useEffect(() => {
    if (!pulling) { setSlotSymbols(["🎨", "✨", "👑"]); return; }
    const iv = setInterval(() => {
      setSlotSymbols([
        SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)],
        SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)],
        SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)],
      ]);
    }, 100);
    return () => clearInterval(iv);
  }, [pulling]);

  useEffect(() => {
    if (pulling) {
      pulseAnim.setValue(0);
      pulseLoop.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
        ])
      );
      pulseLoop.current.start();
    } else {
      pulseLoop.current?.stop();
    }
  }, [pulling]);

  useEffect(() => {
    if (result) {
      resultScale.setValue(0.7);
      resultOpacity.setValue(0);
      Animated.parallel([
        Animated.spring(resultScale, { toValue: 1, friction: 5, tension: 120, useNativeDriver: true }),
        Animated.timing(resultOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
      ]).start();
    }
  }, [result]);

  async function init() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.push("/auth"); return; }
    setAuthToken(session.access_token);
    setUserId(session.user.id);

    const { data: profile } = await supabase
      .from("aa_profiles")
      .select("text_color, avatar_border_color, card_color, gacha_badge")
      .eq("id", session.user.id).single();

    setTextColor(profile?.text_color ?? null);
    setAvatarBorderColor(profile?.avatar_border_color ?? null);
    setCardColor(profile?.card_color ?? null);
    setGachaBadge(profile?.gacha_badge ?? null);

    await Promise.all([fetchPoints(session.user.id), fetchInventory(session.user.id)]);
    setLoading(false);
  }

  async function fetchPoints(uid: string) {
    const { data } = await supabase.from("aa_points").select("amount").eq("user_id", uid);
    setPoints((data ?? []).reduce((s: number, r: { amount: number }) => s + r.amount, 0));
  }

  async function fetchInventory(uid: string) {
    const { data } = await supabase
      .from("aa_gacha_inventory")
      .select("*, aa_gacha_items(*), aa_apps(id, name, icon_url)")
      .eq("user_id", uid).order("obtained_at", { ascending: false });
    setInventory((data as InventoryItem[]) ?? []);
  }

  async function pullGacha(type: string) {
    if (!authToken || pulling) return;
    const info = GACHA_INFO.find((g) => g.type === type);
    if (!info || points < info.cost) {
      Alert.alert("ポイント不足", `${info?.cost}pt必要です（現在${points}pt）`);
      return;
    }
    setPulling(type);
    setResult(null);
    setResultType(null);
    try {
      const res = await fetch(WEB_API, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ type }),
      });
      const data = await res.json();
      if (!res.ok) { Alert.alert("エラー", data.error ?? "ガチャに失敗しました"); return; }
      setResult(data.item);
      setResultType(type);
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        await fetchPoints(session.user.id);
        await fetchInventory(session.user.id);
      }
    } catch { Alert.alert("通信エラー", "もう一度試してください"); }
    finally { setPulling(null); }
  }

  async function applyColor(column: string, value: string) {
    if (!userId) return;
    await supabase.from("aa_profiles").update({ [column]: value }).eq("id", userId);
    if (column === "text_color") setTextColor(value);
    else if (column === "avatar_border_color") setAvatarBorderColor(value);
    else if (column === "card_color") setCardColor(value);
  }

  async function equipBadge(v: string) {
    if (!userId) return;
    await supabase.from("aa_profiles").update({ gacha_badge: v }).eq("id", userId);
    setGachaBadge(v);
  }

  function getColumnForCategory(category: string) {
    if (category === "color_text") return "text_color";
    if (category === "color_avatar") return "avatar_border_color";
    if (category === "color_card") return "card_color";
    return null;
  }

  function getCurrentColorForCategory(category: string) {
    if (category === "color_text") return textColor;
    if (category === "color_avatar") return avatarBorderColor;
    if (category === "color_card") return cardColor;
    return null;
  }

  if (loading) return <ActivityIndicator style={{ flex: 1 }} />;

  const pulseOpacity = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] });
  const pulseScale = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1.03] });

  const isColorCategory = (cat: string) => ["color_text", "color_avatar", "color_card"].includes(cat);

  const textColorInv   = inventory.filter((i) => i.aa_gacha_items?.category === "color_text");
  const avatarColorInv = inventory.filter((i) => i.aa_gacha_items?.category === "color_avatar");
  const cardColorInv   = inventory.filter((i) => i.aa_gacha_items?.category === "color_card");
  const badgeInventory = inventory.filter((i) => i.aa_gacha_items?.category === "badge");
  const appInventory   = inventory.filter((i) => i.app_id);

  const renderColorSection = (
    items: InventoryItem[],
    category: string,
    currentColor: string | null,
  ) => {
    const meta = COLOR_CATEGORY_META[category];
    const column = getColumnForCategory(category)!;
    const activeItem = items.find((i) => i.aa_gacha_items?.value === currentColor);

    if (items.length === 0) return null;
    return (
      <View style={s.invSection} key={category}>
        {/* セクションヘッダー */}
        <View style={s.colorSectionHeader}>
          <Text style={s.colorSectionIcon}>{meta.icon}</Text>
          <View style={{ flex: 1 }}>
            <Text style={s.invTitle}>{meta.label}（{items.length}/20）</Text>
            <Text style={s.colorSectionDesc}>→ {meta.desc}</Text>
          </View>
        </View>

        {/* 現在設定中 */}
        {currentColor && (
          <View style={s.currentColorRow}>
            <View style={[s.currentColorDot, { backgroundColor: currentColor }]} />
            <View style={{ flex: 1 }}>
              <Text style={s.currentColorLabel}>現在設定中</Text>
              {activeItem && <Text style={s.currentColorName}>{activeItem.aa_gacha_items?.name}</Text>}
            </View>
            <Text style={s.currentColorHex}>{currentColor}</Text>
          </View>
        )}

        <View style={s.colorGrid}>
          {items.map((i) => {
            const val = i.aa_gacha_items?.value ?? "";
            const name = i.aa_gacha_items?.name ?? "";
            const isActive = currentColor === val;
            return (
              <TouchableOpacity
                key={i.id}
                style={s.colorItem}
                onPress={() => val && applyColor(column, val)}
              >
                <View style={[s.colorDot, { backgroundColor: val }, isActive && s.colorDotActive]}>
                  {isActive && <Text style={s.colorDotCheck}>✓</Text>}
                </View>
                <Text style={[s.colorName, isActive && s.colorNameActive]} numberOfLines={1}>
                  {name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  };

  return (
    <ScrollView style={s.container} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      {/* ポイント表示 */}
      <View style={s.pointsBox}>
        <Text style={s.pointsLabel}>所持ポイント</Text>
        <Text style={s.pointsValue}>{points.toLocaleString()} pt</Text>
      </View>

      {/* タブ */}
      <View style={s.tabRow}>
        {(["gacha", "inventory"] as const).map((t) => (
          <TouchableOpacity
            key={t}
            style={[s.tabBtn, tab === t && s.tabBtnActive]}
            onPress={() => setTab(t)}
          >
            <Text style={[s.tabBtnText, tab === t && s.tabBtnTextActive]}>
              {t === "gacha" ? "ガチャを引く" : `所持アイテム (${inventory.length})`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === "gacha" && (
        <View style={{ gap: 12 }}>
          {GACHA_INFO.map((g) => (
            <View key={g.type} style={s.gachaCard}>
              <View style={s.gachaInfo}>
                <Text style={s.gachaIcon}>{g.icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={s.gachaName}>{g.name}</Text>
                  <Text style={s.gachaDesc}>{g.description}</Text>
                </View>
                <Text style={s.gachaCost}>{g.cost}pt</Text>
              </View>
              <TouchableOpacity
                style={[s.pullBtn, (!!pulling || points < g.cost) && { opacity: 0.4 }]}
                onPress={() => pullGacha(g.type)}
                disabled={!!pulling || points < g.cost}
              >
                <Text style={s.pullBtnText}>
                  {pulling === g.type ? "🎰 回転中..." : `${g.cost}ptで引く`}
                </Text>
              </TouchableOpacity>

              {/* スロット演出 */}
              {pulling === g.type && (
                <Animated.View
                  style={[s.slotBox, { opacity: pulseOpacity, transform: [{ scale: pulseScale }] }]}
                >
                  <View style={s.slotReels}>
                    {slotSymbols.map((sym, i) => (
                      <View key={i} style={s.slotReel}>
                        <Text style={s.slotEmoji}>{sym}</Text>
                      </View>
                    ))}
                  </View>
                  <Text style={s.slotLabel}>判定中...</Text>
                </Animated.View>
              )}

              {/* 結果 */}
              {resultType === g.type && result && (
                <Animated.View
                  style={[s.resultBox, { opacity: resultOpacity, transform: [{ scale: resultScale }] }]}
                >
                  <TouchableOpacity
                    style={s.resultClose}
                    onPress={() => { setResult(null); setResultType(null); }}
                  >
                    <Text style={s.resultCloseText}>✕</Text>
                  </TouchableOpacity>
                  <Text style={[s.rarityLabel, { color: RARITY_COLOR[result.rarity] }]}>
                    ✦ {RARITY_LABEL[result.rarity]} ✦
                  </Text>

                  {isColorCategory(result.category) ? (
                    <>
                      <View style={[s.colorCircle, { backgroundColor: result.value }]} />
                      <Text style={s.resultName}>{result.name}</Text>
                      <Text style={s.resultSub}>{result.value}</Text>
                      {/* どこに反映されるか明記 */}
                      <View style={s.categoryBadge}>
                        <Text style={s.categoryBadgeText}>
                          {COLOR_CATEGORY_META[result.category]?.icon} {COLOR_CATEGORY_META[result.category]?.label}
                          {" "}— {COLOR_CATEGORY_META[result.category]?.desc}
                        </Text>
                      </View>
                      {getCurrentColorForCategory(result.category) === result.value ? (
                        <View style={s.equippedBadge}>
                          <Text style={s.equippedBadgeText}>✓ 現在設定中</Text>
                        </View>
                      ) : (
                        <TouchableOpacity
                          style={[s.applyBtn, { backgroundColor: result.value }]}
                          onPress={() => {
                            const col = getColumnForCategory(result.category);
                            if (col) applyColor(col, result.value);
                          }}
                        >
                          <Text style={{ color: "#fff", fontWeight: "700" }}>
                            プロフィールに設定する
                          </Text>
                        </TouchableOpacity>
                      )}
                    </>
                  ) : result.category === "badge" ? (
                    <>
                      <Text style={{ fontSize: 60, marginVertical: 10 }}>{result.value}</Text>
                      <Text style={s.resultName}>{result.name}</Text>
                      {gachaBadge === result.value ? (
                        <View style={s.equippedBadge}><Text style={s.equippedBadgeText}>✓ 装備中</Text></View>
                      ) : (
                        <TouchableOpacity style={s.applyBtn} onPress={() => equipBadge(result.value)}>
                          <Text style={{ color: "#fff", fontWeight: "700" }}>プロフィールに装備する</Text>
                        </TouchableOpacity>
                      )}
                    </>
                  ) : (
                    <>
                      {result.icon_url && <Image source={{ uri: result.icon_url }} style={s.appIcon} />}
                      <Text style={s.resultName}>{result.name}</Text>
                      <TouchableOpacity style={s.applyBtn} onPress={() => router.push(`/apps/${result.value}`)}>
                        <Text style={{ color: "#fff", fontWeight: "700" }}>アプリを見る</Text>
                      </TouchableOpacity>
                    </>
                  )}
                </Animated.View>
              )}
            </View>
          ))}
        </View>
      )}

      {tab === "inventory" && (
        <View style={{ gap: 16 }}>
          {/* 3種類のカラーセクション */}
          {renderColorSection(textColorInv, "color_text", textColor)}
          {renderColorSection(avatarColorInv, "color_avatar", avatarBorderColor)}
          {renderColorSection(cardColorInv, "color_card", cardColor)}

          {/* バッジ */}
          {badgeInventory.length > 0 && (
            <View style={s.invSection}>
              <Text style={s.invTitle}>バッジ ({badgeInventory.length}個)</Text>
              <View style={s.badgeGrid}>
                {badgeInventory.map((i) => {
                  const isEquipped = gachaBadge === i.aa_gacha_items?.value;
                  return (
                    <TouchableOpacity
                      key={i.id}
                      style={[s.badgeChip, isEquipped && s.badgeChipActive]}
                      onPress={() => i.aa_gacha_items?.value && equipBadge(i.aa_gacha_items.value)}
                    >
                      <Text style={{ fontSize: 20 }}>{i.aa_gacha_items?.value}</Text>
                      <Text style={[s.badgeName, { color: RARITY_COLOR[i.aa_gacha_items?.rarity ?? "common"] }]}>
                        {i.aa_gacha_items?.name}
                      </Text>
                      {isEquipped && <Text style={s.equippedChip}>装備中</Text>}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* アプリコレクション */}
          <View style={s.invSection}>
            <Text style={s.invTitle}>
              アプリコレクション ({appInventory.length}/100){appInventory.length === 100 ? " 👑" : ""}
            </Text>
            {appInventory.length === 0 ? (
              <Text style={s.invEmpty}>プレミアムガチャでアプリを集めよう</Text>
            ) : (
              <View style={s.appGrid}>
                {appInventory.map((i) => (
                  <TouchableOpacity key={i.id} onPress={() => router.push(`/apps/${i.app_id}`)}>
                    <View style={s.appCard}>
                      {i.aa_apps?.icon_url ? (
                        <Image source={{ uri: i.aa_apps.icon_url }} style={s.appCardIcon} />
                      ) : (
                        <View style={[s.appCardIcon, { backgroundColor: isDark ? "#27272a" : "#e4e4e7", alignItems: "center", justifyContent: "center" }]}>
                          <Text style={{ fontSize: 18 }}>📱</Text>
                        </View>
                      )}
                    </View>
                    <Text style={s.appCardName} numberOfLines={1}>{i.aa_apps?.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {inventory.length === 0 && (
            <View style={{ alignItems: "center", paddingTop: 60, gap: 10 }}>
              <Text style={{ fontSize: 44 }}>🎰</Text>
              <Text style={{ color: "#71717a", fontSize: 14 }}>まだアイテムがありません</Text>
            </View>
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = (isDark: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: isDark ? "#09090b" : "#f4f4f5" },
  pointsBox: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    backgroundColor: isDark ? "#18181b" : "#ffffff",
    borderRadius: 14, padding: 14, marginBottom: 12,
    borderWidth: 1, borderColor: isDark ? "#27272a" : "#e4e4e7",
  },
  pointsLabel: { fontSize: 13, color: isDark ? "#71717a" : "#a1a1aa" },
  pointsValue: { fontSize: 20, fontWeight: "700", color: isDark ? "#ffffff" : "#09090b" },
  tabRow: { flexDirection: "row", gap: 8, marginBottom: 14 },
  tabBtn: { flex: 1, paddingVertical: 9, borderRadius: 10, alignItems: "center", backgroundColor: isDark ? "#27272a" : "#e4e4e7" },
  tabBtnActive: { backgroundColor: isDark ? "#ffffff" : "#09090b" },
  tabBtnText: { fontSize: 13, fontWeight: "500", color: isDark ? "#a1a1aa" : "#71717a" },
  tabBtnTextActive: { color: isDark ? "#09090b" : "#ffffff" },
  gachaCard: { backgroundColor: isDark ? "#18181b" : "#ffffff", borderRadius: 14, padding: 14, borderWidth: 1, borderColor: isDark ? "#27272a" : "#e4e4e7" },
  gachaInfo: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  gachaIcon: { fontSize: 28 },
  gachaName: { fontSize: 15, fontWeight: "700", color: isDark ? "#ffffff" : "#09090b" },
  gachaDesc: { fontSize: 12, color: isDark ? "#71717a" : "#a1a1aa", marginTop: 2 },
  gachaCost: { fontSize: 17, fontWeight: "700", color: isDark ? "#ffffff" : "#09090b" },
  pullBtn: { backgroundColor: isDark ? "#ffffff" : "#09090b", borderRadius: 10, padding: 12, alignItems: "center" },
  pullBtnText: { fontSize: 14, fontWeight: "700", color: isDark ? "#09090b" : "#ffffff" },
  slotBox: {
    marginTop: 12, borderRadius: 12, padding: 16, alignItems: "center",
    backgroundColor: isDark ? "#09090b" : "#f9f9f9",
    borderWidth: 1, borderColor: isDark ? "#3f3f46" : "#e4e4e7",
  },
  slotReels: { flexDirection: "row", gap: 10, marginBottom: 10 },
  slotReel: {
    width: 56, height: 56, borderRadius: 10,
    backgroundColor: isDark ? "#18181b" : "#ffffff",
    borderWidth: 1, borderColor: isDark ? "#3f3f46" : "#d4d4d8",
    alignItems: "center", justifyContent: "center",
  },
  slotEmoji: { fontSize: 28 },
  slotLabel: { fontSize: 13, color: isDark ? "#71717a" : "#a1a1aa", fontWeight: "500" },
  resultBox: {
    marginTop: 12, padding: 16, borderRadius: 12,
    backgroundColor: isDark ? "#09090b" : "#f9f9f9",
    borderWidth: 1, borderColor: isDark ? "#3f3f46" : "#e4e4e7",
    alignItems: "center", position: "relative",
  },
  resultClose: { position: "absolute", top: 10, right: 12 },
  resultCloseText: { fontSize: 16, color: isDark ? "#71717a" : "#a1a1aa" },
  rarityLabel: { fontSize: 12, fontWeight: "800", letterSpacing: 2, marginBottom: 10 },
  colorCircle: { width: 72, height: 72, borderRadius: 36, marginBottom: 8 },
  resultName: { fontSize: 16, fontWeight: "700", color: isDark ? "#ffffff" : "#09090b", marginBottom: 4 },
  resultSub: { fontSize: 12, color: "#71717a", marginBottom: 6 },
  categoryBadge: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 99,
    backgroundColor: isDark ? "#27272a" : "#f4f4f5", marginBottom: 8,
  },
  categoryBadgeText: { fontSize: 11, color: isDark ? "#a1a1aa" : "#71717a", fontWeight: "500" },
  applyBtn: { backgroundColor: "#09090b", borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10, marginTop: 4 },
  equippedBadge: { marginTop: 8, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 99, backgroundColor: isDark ? "#27272a" : "#e4e4e7" },
  equippedBadgeText: { fontSize: 13, color: isDark ? "#a1a1aa" : "#71717a", fontWeight: "600" },
  appIcon: { width: 72, height: 72, borderRadius: 16, marginBottom: 8 },
  // Inventory
  invSection: { backgroundColor: isDark ? "#18181b" : "#ffffff", borderRadius: 14, padding: 14, borderWidth: 1, borderColor: isDark ? "#27272a" : "#e4e4e7" },
  invTitle: { fontSize: 13, fontWeight: "600", color: isDark ? "#a1a1aa" : "#71717a", marginBottom: 4 },
  invEmpty: { fontSize: 13, color: "#71717a" },
  colorSectionHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  colorSectionIcon: { fontSize: 22 },
  colorSectionDesc: { fontSize: 11, color: isDark ? "#52525b" : "#a1a1aa", marginTop: 1 },
  currentColorRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: isDark ? "#09090b" : "#f4f4f5",
    borderRadius: 10, padding: 10, marginBottom: 14,
    borderWidth: 1, borderColor: isDark ? "#3f3f46" : "#d4d4d8",
  },
  currentColorDot: { width: 36, height: 36, borderRadius: 18, borderWidth: 3, borderColor: isDark ? "#ffffff" : "#09090b" },
  currentColorLabel: { fontSize: 11, color: isDark ? "#a1a1aa" : "#71717a", fontWeight: "600" },
  currentColorName: { fontSize: 14, fontWeight: "700", color: isDark ? "#ffffff" : "#09090b" },
  currentColorHex: { fontSize: 11, color: isDark ? "#52525b" : "#a1a1aa" },
  colorGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  colorItem: { alignItems: "center", width: 52 },
  colorDot: {
    width: 44, height: 44, borderRadius: 22,
    borderWidth: 2.5, borderColor: "transparent",
    alignItems: "center", justifyContent: "center",
  },
  colorDotActive: { borderColor: isDark ? "#ffffff" : "#09090b", transform: [{ scale: 1.12 }] },
  colorDotCheck: { fontSize: 16, color: "#fff", fontWeight: "800", textShadowColor: "rgba(0,0,0,0.5)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },
  colorName: { fontSize: 9, color: isDark ? "#52525b" : "#a1a1aa", marginTop: 3, textAlign: "center" },
  colorNameActive: { color: isDark ? "#a1a1aa" : "#71717a", fontWeight: "600" },
  badgeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  badgeChip: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 99,
    borderWidth: 1.5, borderColor: isDark ? "#3f3f46" : "#e4e4e7",
    backgroundColor: isDark ? "#09090b" : "#f9f9f9",
  },
  badgeChipActive: { borderColor: "#a855f7", backgroundColor: isDark ? "#1a0a2e" : "#faf5ff" },
  badgeName: { fontSize: 12, fontWeight: "500" },
  equippedChip: { fontSize: 11, color: "#a855f7", fontWeight: "700" },
  appGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  appCard: { width: 60, height: 60, borderRadius: 14, overflow: "hidden", borderWidth: 2, borderColor: "#22c55e" },
  appCardIcon: { width: "100%", height: "100%" },
  appCardName: { fontSize: 10, color: isDark ? "#71717a" : "#a1a1aa", width: 60, textAlign: "center", marginTop: 3 },
});
