import { View, Text, StyleSheet } from "react-native";

export type BadgeType = "master" | "platinum" | "gold" | "silver" | "bronze" | null | undefined;

export function isPremiumBadge(badge: BadgeType): boolean {
  return badge === "master" || badge === "platinum" || badge === "gold";
}

const BADGE_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  master:   { label: "👑 Master",   bg: "#7c3aed", text: "#fff" },
  platinum: { label: "💎 Platinum", bg: "#0ea5e9", text: "#fff" },
  gold:     { label: "🥇 Gold",     bg: "#d97706", text: "#fff" },
  silver:   { label: "🥈 Silver",   bg: "#6b7280", text: "#fff" },
  bronze:   { label: "🥉 Bronze",   bg: "#92400e", text: "#fff" },
};

type Props = { badge: BadgeType; size?: "sm" | "xs" };

export default function Badge({ badge, size = "sm" }: Props) {
  if (!badge || !BADGE_CONFIG[badge]) return null;
  const { label, bg, text } = BADGE_CONFIG[badge];
  const fontSize = size === "xs" ? 9 : 11;
  const paddingH = size === "xs" ? 5 : 7;
  const paddingV = size === "xs" ? 1 : 2;
  return (
    <View style={[styles.badge, { backgroundColor: bg, paddingHorizontal: paddingH, paddingVertical: paddingV }]}>
      <Text style={[styles.text, { color: text, fontSize }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { borderRadius: 99 },
  text: { fontWeight: "700" },
});
