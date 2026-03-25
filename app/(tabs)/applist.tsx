import { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import FilteredAppList from "@/components/FilteredAppList";
import { useTheme } from "@/lib/theme";

const PLATFORM_FILTERS = ["iOS", "Mac", "Windows", "クロスプラットフォーム"];

export default function AppListScreen() {
  const { isDark } = useTheme();
  const s = styles(isDark);
  const [platform, setPlatform] = useState("iOS");

  return (
    <View style={{ flex: 1, backgroundColor: isDark ? "#09090b" : "#f2f2f7" }}>
      {/* Platform filter tabs */}
      <View style={s.tabRow}>
        {PLATFORM_FILTERS.map((p) => (
          <TouchableOpacity
            key={p}
            style={[s.tab, platform === p && s.tabActive]}
            onPress={() => setPlatform(p)}
          >
            <Text style={[s.tabText, platform === p && s.tabTextActive]}>{p}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <FilteredAppList key={platform} tag={platform} emptyMessage={`${platform}アプリが見つかりません`} />
    </View>
  );
}

const styles = (isDark: boolean) => StyleSheet.create({
  tabRow: {
    flexDirection: "row", backgroundColor: isDark ? "#18181b" : "#ffffff",
    borderBottomWidth: 1, borderBottomColor: isDark ? "#27272a" : "#e4e4e7",
    paddingHorizontal: 12, paddingVertical: 8, gap: 6,
  },
  tab: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 99, borderWidth: 1, borderColor: isDark ? "#3f3f46" : "#e4e4e7" },
  tabActive: { backgroundColor: isDark ? "#ffffff" : "#09090b", borderColor: "transparent" },
  tabText: { fontSize: 12, fontWeight: "600", color: isDark ? "#a1a1aa" : "#71717a" },
  tabTextActive: { color: isDark ? "#09090b" : "#ffffff" },
});
