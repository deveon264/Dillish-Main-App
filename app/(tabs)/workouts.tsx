import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, ImageBackground, TextInput } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { GradientBackground } from "@/components/GradientBackground";
import { useInsets } from "@/hooks/useInsets";
import { useAuth } from "@/contexts/AuthContext";
import { WORKOUTS, CATEGORIES } from "@/constants/workouts";
import { colors } from "@/constants/colors";
import { fonts } from "@/constants/fonts";

export default function Workouts() {
  const router = useRouter();
  const insets = useInsets();
  const { user } = useAuth();
  const firstName = (user?.name ?? "there").split(" ")[0];
  const [category, setCategory] = useState("All");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    return WORKOUTS.filter((w) => {
      const matchCat = category === "All" || w.category === category;
      const matchQuery = query.trim() === "" || w.title.toLowerCase().includes(query.trim().toLowerCase());
      return matchCat && matchQuery;
    });
  }, [category, query]);

  return (
    <GradientBackground>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 110 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>EXPLORE</Text>
            <Text style={styles.title}>
              Workout <Text style={styles.titleItalic}>Library</Text>
            </Text>
          </View>
          <Pressable style={styles.headerBtn} hitSlop={6}>
            <Ionicons name="options-outline" size={20} color={colors.foreground} />
          </Pressable>
          <Pressable style={styles.avatar} onPress={() => router.navigate("/(tabs)/profile")}>
            <Text style={styles.avatarText}>{firstName.charAt(0).toUpperCase()}</Text>
          </Pressable>
        </View>

        <View style={styles.search}>
          <Ionicons name="search-outline" size={18} color={colors.mutedForeground} />
          <TextInput
            placeholder="Search workouts, trainers…"
            placeholderTextColor={colors.mutedForeground}
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
          />
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.cats}
        >
          {CATEGORIES.map((c) => {
            const on = category === c;
            return (
              <Pressable key={c} style={[styles.cat, on && styles.catOn]} onPress={() => setCategory(c)}>
                <Text style={[styles.catText, on && styles.catTextOn]}>{c}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filters}
        >
          <View style={[styles.filterChip, styles.filterChipActive]}>
            <Ionicons name="options-outline" size={15} color={colors.accent} />
            <Text style={[styles.filterText, styles.filterTextActive]}>Filter</Text>
          </View>
          <View style={styles.filterChip}>
            <Ionicons name="time-outline" size={15} color={colors.muted} />
            <Text style={styles.filterText}>Duration</Text>
            <Ionicons name="chevron-down" size={13} color={colors.muted} />
          </View>
          <View style={styles.filterChip}>
            <Ionicons name="stats-chart-outline" size={15} color={colors.muted} />
            <Text style={styles.filterText}>Level</Text>
            <Ionicons name="chevron-down" size={13} color={colors.muted} />
          </View>
          <View style={styles.filterChip}>
            <Ionicons name="heart-outline" size={15} color={colors.muted} />
            <Text style={styles.filterText}>Saved</Text>
          </View>
        </ScrollView>

        {filtered.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="leaf-outline" size={40} color={colors.mutedForeground} />
            <Text style={styles.emptyText}>No workouts match your search</Text>
          </View>
        ) : (
          <View style={styles.list}>
            {filtered.map((w) => (
              <Pressable key={w.id} style={styles.card} onPress={() => router.push(`/workout/${w.id}`)}>
                <ImageBackground source={w.image} style={styles.cardImg} imageStyle={styles.cardImgRadius}>
                  <LinearGradient colors={["rgba(44,36,34,0.05)", "rgba(44,36,34,0.85)"]} style={StyleSheet.absoluteFill} />
                  <View style={styles.cardBody}>
                    <View style={styles.cardBadge}>
                      <Text style={styles.cardBadgeText}>{w.level}</Text>
                    </View>
                    <View>
                      <Text style={styles.cardCat}>{w.category}</Text>
                      <Text style={styles.cardTitle}>{w.title}</Text>
                      <View style={styles.cardMeta}>
                        <View style={styles.metaItem}>
                          <Ionicons name="time-outline" size={14} color={colors.foreground} />
                          <Text style={styles.metaText}>{w.durationMin} min</Text>
                        </View>
                        <View style={styles.metaItem}>
                          <Ionicons name="flame-outline" size={14} color={colors.foreground} />
                          <Text style={styles.metaText}>{w.kcal} kcal</Text>
                        </View>
                      </View>
                    </View>
                  </View>
                  <View style={styles.play}>
                    <Ionicons name="play" size={18} color={colors.onPrimary} />
                  </View>
                </ImageBackground>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 20 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 4 },
  eyebrow: { fontFamily: fonts.sansMedium, fontSize: 12, color: colors.muted, letterSpacing: 3 },
  title: { fontFamily: fonts.serif, fontSize: 34, color: colors.foreground, marginTop: 2 },
  titleItalic: { fontFamily: fonts.serifItalic, fontStyle: "italic", color: colors.foreground },
  headerBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: colors.accent,
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontFamily: fonts.serifSemibold, fontSize: 18, color: colors.accent },
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: colors.radius,
    paddingHorizontal: 14,
    minHeight: 50,
    marginTop: 18,
  },
  searchInput: { flex: 1, fontFamily: fonts.sans, fontSize: 15, color: colors.foreground, paddingVertical: 12 },
  cats: { gap: 10, paddingVertical: 18, paddingRight: 8 },
  cat: {
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.card,
  },
  catOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  catText: { fontFamily: fonts.sansMedium, fontSize: 14, color: colors.muted },
  catTextOn: { color: colors.onPrimary },
  filters: { gap: 10, paddingBottom: 18, paddingRight: 8 },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.card,
  },
  filterChipActive: { borderColor: colors.accent, backgroundColor: "rgba(201,137,122,0.14)" },
  filterText: { fontFamily: fonts.sansMedium, fontSize: 13.5, color: colors.muted },
  filterTextActive: { color: colors.accent },
  list: { gap: 16 },
  card: { borderRadius: colors.radiusLg, overflow: "hidden" },
  cardImg: { height: 180, justifyContent: "space-between" },
  cardImgRadius: { borderRadius: colors.radiusLg },
  cardBody: { flex: 1, justifyContent: "space-between", padding: 16 },
  cardBadge: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(247,235,232,0.18)",
    paddingHorizontal: 11,
    paddingVertical: 4,
    borderRadius: 16,
  },
  cardBadgeText: { fontFamily: fonts.sansSemibold, fontSize: 10.5, color: colors.foreground, letterSpacing: 0.4 },
  cardCat: { fontFamily: fonts.sansSemibold, fontSize: 11, color: colors.accent, letterSpacing: 0.5 },
  cardTitle: { fontFamily: fonts.serifSemibold, fontSize: 22, color: colors.foreground, marginTop: 2 },
  cardMeta: { flexDirection: "row", gap: 16, marginTop: 6 },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  metaText: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.foreground },
  play: {
    position: "absolute",
    top: 16,
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  empty: { alignItems: "center", paddingVertical: 60, gap: 12 },
  emptyText: { fontFamily: fonts.sans, fontSize: 15, color: colors.muted },
});
