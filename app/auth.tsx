import { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, Alert, ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useTheme } from "@/lib/theme";
import * as AppleAuthentication from "expo-apple-authentication";

export default function AuthScreen() {
  const { isDark } = useTheme();
  const s = styles(isDark);
  const router = useRouter();

  const [tab, setTab] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [resetSent, setResetSent] = useState(false);

  const handleLogin = async () => {
    setLoading(true); setMsg("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setMsg("メールアドレスまたはパスワードが間違っています");
    } else {
      router.replace("/(tabs)");
    }
    setLoading(false);
  };

  const handleResetPassword = async () => {
    if (!email) { setMsg("メールアドレスを入力してください"); return; }
    setLoading(true); setMsg("");
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    setLoading(false);
    if (error) {
      setMsg("送信に失敗しました: " + error.message);
    } else {
      setResetSent(true);
      setMsg("パスワードリセットのメールを送信しました");
    }
  };

  const handleAppleSignIn = async () => {
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (!credential.identityToken) {
        Alert.alert("エラー", "Apple認証に失敗しました");
        return;
      }
      setLoading(true);
      const { error } = await supabase.auth.signInWithIdToken({
        provider: "apple",
        token: credential.identityToken,
      });
      if (error) {
        setMsg("Apple認証に失敗しました: " + error.message);
      } else {
        router.replace("/(tabs)");
      }
      setLoading(false);
    } catch (e: unknown) {
      if ((e as { code?: string }).code !== "ERR_REQUEST_CANCELED") {
        Alert.alert("エラー", "Apple認証に失敗しました");
      }
    }
  };

  const handleSignUp = async () => {
    setLoading(true); setMsg("");
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) {
      setMsg("登録に失敗しました: " + error.message);
    } else if (data.session) {
      router.replace("/(tabs)");
    } else {
      setMsg("確認メールを送信しました。メールを確認してください。");
    }
    setLoading(false);
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={s.container}>
      <View style={s.inner}>
        <Text style={s.title}>App Atelier</Text>
        <Text style={s.subtitle}>個人開発者のアプリショーケース</Text>

        <View style={s.tabs}>
          <TouchableOpacity style={[s.tabBtn, tab === "login" && s.tabBtnActive]} onPress={() => setTab("login")}>
            <Text style={[s.tabBtnText, tab === "login" && s.tabBtnTextActive]}>ログイン</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.tabBtn, tab === "signup" && s.tabBtnActive]} onPress={() => setTab("signup")}>
            <Text style={[s.tabBtnText, tab === "signup" && s.tabBtnTextActive]}>新規登録</Text>
          </TouchableOpacity>
        </View>

        {Platform.OS === "ios" && (
          <>
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
              buttonStyle={isDark
                ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
                : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
              cornerRadius={12}
              style={{ width: "100%", height: 50 }}
              onPress={handleAppleSignIn}
            />
            <View style={s.dividerRow}>
              <View style={s.dividerLine} />
              <Text style={s.dividerText}>または</Text>
              <View style={s.dividerLine} />
            </View>
          </>
        )}

        <TextInput
          style={s.input}
          value={email}
          onChangeText={setEmail}
          placeholder="メールアドレス"
          placeholderTextColor={isDark ? "#52525b" : "#a1a1aa"}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <View style={{ height: 12 }} />
        <TextInput
          style={s.input}
          value={password}
          onChangeText={setPassword}
          placeholder="パスワード"
          placeholderTextColor={isDark ? "#52525b" : "#a1a1aa"}
          secureTextEntry
        />

        {msg ? <Text style={[s.msg, resetSent && { color: "#22c55e" }]}>{msg}</Text> : null}

        <TouchableOpacity
          style={s.submitBtn}
          onPress={tab === "login" ? handleLogin : handleSignUp}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={isDark ? "#09090b" : "#ffffff"} />
          ) : (
            <Text style={s.submitBtnText}>{tab === "login" ? "ログイン" : "登録する"}</Text>
          )}
        </TouchableOpacity>

        {tab === "login" && (
          <TouchableOpacity onPress={handleResetPassword} style={{ marginTop: 16, alignItems: "center" }} disabled={loading}>
            <Text style={s.resetLink}>パスワードをお忘れの方</Text>
          </TouchableOpacity>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = (isDark: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: isDark ? "#09090b" : "#f4f4f5" },
  inner: { flex: 1, justifyContent: "center", padding: 32 },
  title: { fontSize: 32, fontWeight: "800", color: isDark ? "#ffffff" : "#09090b", textAlign: "center", marginBottom: 8 },
  subtitle: { fontSize: 14, color: isDark ? "#71717a" : "#a1a1aa", textAlign: "center", marginBottom: 40 },
  tabs: { flexDirection: "row", backgroundColor: isDark ? "#18181b" : "#e4e4e7", borderRadius: 10, padding: 4, marginBottom: 24 },
  tabBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: "center" },
  tabBtnActive: { backgroundColor: isDark ? "#ffffff" : "#ffffff" },
  tabBtnText: { fontSize: 14, fontWeight: "600", color: isDark ? "#71717a" : "#71717a" },
  tabBtnTextActive: { color: isDark ? "#09090b" : "#09090b" },
  input: {
    backgroundColor: isDark ? "#18181b" : "#ffffff",
    borderWidth: 1, borderColor: isDark ? "#3f3f46" : "#e4e4e7",
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 15, color: isDark ? "#ffffff" : "#09090b",
  },
  msg: { fontSize: 13, color: "#ef4444", marginTop: 12, textAlign: "center" },
  submitBtn: {
    marginTop: 24, backgroundColor: isDark ? "#ffffff" : "#09090b",
    borderRadius: 12, paddingVertical: 16, alignItems: "center",
  },
  submitBtnText: { color: isDark ? "#09090b" : "#ffffff", fontSize: 16, fontWeight: "700" },
  resetLink: { fontSize: 13, color: isDark ? "#71717a" : "#a1a1aa", textDecorationLine: "underline" },
  dividerRow: { flexDirection: "row", alignItems: "center", marginVertical: 20, gap: 10 },
  dividerLine: { flex: 1, height: 1, backgroundColor: isDark ? "#27272a" : "#e4e4e7" },
  dividerText: { fontSize: 13, color: isDark ? "#52525b" : "#a1a1aa" },
});
