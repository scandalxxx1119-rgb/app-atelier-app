import { Stack, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { ThemeProvider, useTheme } from "@/lib/theme";
import "react-native-url-polyfill/auto";
import { useEffect, useRef } from "react";
import * as Notifications from "expo-notifications";
import { Platform, View } from "react-native";
import { supabase } from "@/lib/supabase";
import LoginBonus from "@/components/LoginBonus";
import AsyncStorage from "@react-native-async-storage/async-storage";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== "granted") return null;

  const token = await Notifications.getExpoPushTokenAsync({
    projectId: "2b0e43f0-a513-4433-b622-12b79a50c7fa",
  });
  return token.data;
}

function RootLayoutInner() {
  const { isDark } = useTheme();
  const router = useRouter();
  const responseListener = useRef<Notifications.EventSubscription | null>(null);

  useEffect(() => {
    // Onboarding check
    AsyncStorage.getItem("user_role").then((role) => {
      if (!role) router.replace("/onboarding");
    });

    // Push token registration
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const token = await registerForPushNotificationsAsync();
      if (!token) return;
      await supabase
        .from("aa_push_tokens")
        .upsert({ user_id: data.user.id, token }, { onConflict: "user_id,token" });
    });

    // Handle notification taps → navigate to app detail
    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      const appId = response.notification.request.content.data?.app_id as string | undefined;
      if (appId) router.push(`/apps/${appId}`);
    });

    return () => {
      responseListener.current?.remove();
    };
  }, []);

  return (
    <View style={{ flex: 1 }}>
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
        <Stack.Screen name="apps/[id]/index" options={{ title: "" }} />
        <Stack.Screen name="developer-ranking" options={{ title: "開発者ランキング" }} />
        <Stack.Screen name="apps/[id]/edit" options={{ title: "編集" }} />
        <Stack.Screen name="users/[username]" options={{ title: "" }} />
        <Stack.Screen name="board/[postId]" options={{ title: "スレッド" }} />
        <Stack.Screen name="auth" options={{ title: "ログイン", headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
      </Stack>
      <LoginBonus />
    </View>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <RootLayoutInner />
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
