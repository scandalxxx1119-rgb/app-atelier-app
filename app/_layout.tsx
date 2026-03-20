import { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useColorScheme } from "react-native";
import "react-native-url-polyfill/auto";

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

  return (
    <>
      <StatusBar style={isDark ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: isDark ? "#09090b" : "#ffffff" },
          headerTintColor: isDark ? "#ffffff" : "#09090b",
          headerShadowVisible: false,
          contentStyle: { backgroundColor: isDark ? "#09090b" : "#f4f4f5" },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="apps/[id]" options={{ title: "" }} />
        <Stack.Screen name="apps/[id]/edit" options={{ title: "編集" }} />
        <Stack.Screen name="users/[username]" options={{ title: "" }} />
        <Stack.Screen name="submit" options={{ title: "アプリを投稿" }} />
        <Stack.Screen name="auth" options={{ title: "ログイン", headerShown: false }} />
      </Stack>
    </>
  );
}
