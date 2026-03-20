import { Tabs } from "expo-router";
import { Text, useColorScheme } from "react-native";

export default function TabsLayout() {
  const isDark = useColorScheme() === "dark";
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
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "App Atelier",
          tabBarLabel: "一覧",
          tabBarIcon: () => <Text style={{ fontSize: 20 }}>🏠</Text>,
        }}
      />
      <Tabs.Screen
        name="submit"
        options={{
          title: "アプリを投稿",
          tabBarLabel: "投稿",
          tabBarIcon: () => <Text style={{ fontSize: 20 }}>➕</Text>,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "マイページ",
          tabBarLabel: "マイページ",
          tabBarIcon: () => <Text style={{ fontSize: 20 }}>👤</Text>,
        }}
      />
    </Tabs>
  );
}
