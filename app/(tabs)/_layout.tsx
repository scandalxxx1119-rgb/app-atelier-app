import { Tabs, useRouter } from "expo-router";
import { Text, TouchableOpacity, View } from "react-native";
import { useTheme } from "@/lib/theme";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function TabsLayout() {
  const { isDark } = useTheme();
  const router = useRouter();
  const bg = isDark ? "#09090b" : "#ffffff";
  const active = isDark ? "#ffffff" : "#09090b";
  const inactive = isDark ? "#52525b" : "#a1a1aa";

  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const checkUnread = async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;
      const { count } = await supabase
        .from("aa_messages")
        .select("*", { count: "exact", head: true })
        .eq("user_id", auth.user.id)
        .eq("is_read", false);
      setUnreadCount(count ?? 0);
    };
    checkUnread();
  }, []);

  return (
    <Tabs
      screenOptions={{
        tabBarStyle: { backgroundColor: bg, borderTopColor: isDark ? "#27272a" : "#e4e4e7" },
        tabBarActiveTintColor: active,
        tabBarInactiveTintColor: inactive,
        headerStyle: { backgroundColor: bg },
        headerTintColor: active,
        headerShadowVisible: false,
        headerLeft: () => (
          <TouchableOpacity onPress={() => router.push("/(tabs)/profile")} style={{ marginLeft: 16 }}>
            <View>
              <Text style={{ fontSize: 22 }}>👤</Text>
              {unreadCount > 0 && (
                <View style={{
                  position: "absolute", top: -4, right: -6,
                  backgroundColor: "#ef4444", borderRadius: 8,
                  minWidth: 16, height: 16,
                  alignItems: "center", justifyContent: "center",
                  paddingHorizontal: 3,
                }}>
                  <Text style={{ color: "#fff", fontSize: 9, fontWeight: "700" }}>
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        ),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "App Atelier",
          tabBarLabel: "ホーム",
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 22, color }}>🏠</Text>,
          headerRight: () => (
            <TouchableOpacity
              onPress={() => router.push("/developer-ranking")}
              style={{ marginRight: 14, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: isDark ? "#3f3f46" : "#e4e4e7" }}
            >
              <Text style={{ fontSize: 13, fontWeight: "600", color: isDark ? "#ffffff" : "#09090b" }}>🏆 ランキング</Text>
            </TouchableOpacity>
          ),
        }}
      />
      <Tabs.Screen
        name="developers"
        options={{
          title: "開発者",
          tabBarLabel: "開発者",
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 22, color }}>👥</Text>,
        }}
      />
      <Tabs.Screen
        name="board"
        options={{
          title: "掲示板",
          tabBarLabel: "掲示板",
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 22, color }}>💬</Text>,
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: "検索",
          tabBarLabel: "検索",
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 22, color }}>🔍</Text>,
        }}
      />
      <Tabs.Screen name="game" options={{ href: null }} />
      <Tabs.Screen name="applist" options={{ href: null }} />
      <Tabs.Screen name="weblist" options={{ href: null }} />
      <Tabs.Screen name="ranking" options={{ href: null }} />
      <Tabs.Screen name="submit" options={{ href: null }} />
      <Tabs.Screen name="profile" options={{ href: null, title: "マイページ" }} />
    </Tabs>
  );
}
