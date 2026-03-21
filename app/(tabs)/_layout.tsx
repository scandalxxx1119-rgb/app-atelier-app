import { Tabs, useRouter } from "expo-router";
import { Text, TouchableOpacity } from "react-native";
import { useTheme } from "@/lib/theme";

export default function TabsLayout() {
  const { isDark, toggle } = useTheme();
  const router = useRouter();
  const bg = isDark ? "#09090b" : "#ffffff";
  const active = isDark ? "#ffffff" : "#09090b";
  const inactive = isDark ? "#52525b" : "#a1a1aa";

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
            <Text style={{ fontSize: 22 }}>👤</Text>
          </TouchableOpacity>
        ),
        headerRight: () => (
          <TouchableOpacity onPress={toggle} style={{ marginRight: 16 }}>
            <Text style={{ fontSize: 20 }}>{isDark ? "☀️" : "🌙"}</Text>
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
        }}
      />
      <Tabs.Screen
        name="game"
        options={{
          title: "ゲーム",
          tabBarLabel: "ゲーム",
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 22, color }}>🎮</Text>,
        }}
      />
      <Tabs.Screen
        name="applist"
        options={{
          title: "App",
          tabBarLabel: "App",
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 22, color }}>📱</Text>,
        }}
      />
      <Tabs.Screen
        name="weblist"
        options={{
          title: "Web",
          tabBarLabel: "Web",
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 22, color }}>🌐</Text>,
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
      <Tabs.Screen
        name="submit"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="profile"
        options={{ href: null, title: "マイページ" }}
      />
    </Tabs>
  );
}
