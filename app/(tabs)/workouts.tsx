import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, ImageBackground, TextInput, Modal } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { GradientBackground } from "@/components/GradientBackground";
import { HelpButton } from "@/components/HelpButton";
import { useInsets } from "@/hooks/useInsets";
import { useAuth } from "@/contexts/AuthContext";
import { useData } from "@/contexts/DataContext";
import { WORKOUTS, CATEGORIES, Workout } from "@/constants/workouts";
import { colors } from "@/constants/colors";
import { fonts } from "@/constants/fonts";

type DurationOption = { key: string; label: string; test: (min: number) => boolean };

const DURATION_OPTIONS: DurationOption[] = [
  { key: "short", label: "Under 20 min", test: (m) => m < 20 },
  { key: "medium", label: "20 – 40 min", test: (m) => m >= 20 && m <= 40 },
  { key: "long", label: "Over 40 min", test: (m) => m > 40 },
];

const LEVEL_OPTIONS: Workout["level"][] = ["Beginner", "Intermediate", "Advanced"];

export default function Workouts() {
  const router = useRouter();
  const insets = useInsets();
  const { isAdmin } = useAuth();
  const { favorites, toggleFavorite, isFavorite } = useData();
  const [category, setCategory] = useState("All");
  const [query, setQuery] = useState("");
  const [duration, setDuration] = useState<string | null>(null);
  const [level, setLevel] = useState<Workout["level"] | null>(null);
  const [savedOnly, setSavedOnly] = useState(false);
  const [picker, setPicker] = useState<"duration" | "level" | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const activeCount =
    (category !== "All" ? 1 : 0) + (duration ? 1 : 0) + (level ? 1 : 0) + (savedOnly ? 1 : 0);

  const clearFilters = () => {
    setCategory("All");
    setDuration(null);
    setLevel(null);
    setSavedOnly(false);
  };

  const durationLabel = DURATION_OPTIONS.find((o) => o.key === duration)?.label ?? "Duration";

  const filtered = useMemo(() => {
    const durationTest = DURATION_OPTIONS.find((o) => o.key === duration)?.test;
    return WORKOUTS.filter((w) => {
      const matchCat = category === "All" || w.category === category;
      const matchQuery = query.trim() === "" || w.title.toLowerCase().includes(query.trim().toLowerCase());
      const matchDuration = !durationTest || durationTest(w.durationMin);
      const matchLevel = !level || w.level === level;
      const matchSaved = !savedOnly || favorites.includes(w.id);
      return matchCat && matchQuery && matchDuration && matchLevel && matchSaved;
    });
  }, [category, query, duration, level, savedOnly, favorites]);

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
          <HelpButton
            title="Workout Library"
            intro="Find the right session for today and make it your own."
            points={[
              "Browse every class, then filter by type and level to fit your mood.",
              "Save favorites so your go-to workouts are always one tap away.",
              "Tap any workout to start a guided, step-by-step session.",
            ]}
          />
          <Pressable style={styles.headerBtn} hitSlop={6} onPress={() => setShowFilters(true)}>
            <Ionicons name="options-outline" size={20} color={colors.foreground} />
            {activeCount > 0 && (
              <View style={styles.headerBtnBadge}>
                <Text style={styles.headerBtnBadgeText}>{activeCount}</Text>
              </View>
            )}
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

        <Pressable style={styles.videoBanner} onPress={() => router.push("/exercises")}>
          <View style={styles.videoBannerIcon}>
            <Ionicons name="play-circle" size={24} color={colors.onPrimary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.videoBannerTitle}>Exercise Videos</Text>
            <Text style={styles.videoBannerSub}>
              {isAdmin ? "Upload & manage member videos" : "Guided demos from your coach"}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.muted} />
        </Pressable>

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
          <Pressable
            style={[styles.filterChip, activeCount > 0 && styles.filterChipActive]}
            onPress={clearFilters}
            disabled={activeCount === 0}
          >
            <Ionicons
              name={activeCount > 0 ? "close-circle" : "options-outline"}
              size={15}
              color={activeCount > 0 ? colors.accent : colors.muted}
            />
            <Text style={[styles.filterText, activeCount > 0 && styles.filterTextActive]}>
              {activeCount > 0 ? `Clear (${activeCount})` : "Filter"}
            </Text>
          </Pressable>
          <Pressable
            style={[styles.filterChip, duration && styles.filterChipActive]}
            onPress={() => setPicker("duration")}
          >
            <Ionicons name="time-outline" size={15} color={duration ? colors.accent : colors.muted} />
            <Text style={[styles.filterText, duration && styles.filterTextActive]}>{durationLabel}</Text>
            <Ionicons name="chevron-down" size={13} color={duration ? colors.accent : colors.muted} />
          </Pressable>
          <Pressable
            style={[styles.filterChip, level && styles.filterChipActive]}
            onPress={() => setPicker("level")}
          >
            <Ionicons name="stats-chart-outline" size={15} color={level ? colors.accent : colors.muted} />
            <Text style={[styles.filterText, level && styles.filterTextActive]}>{level ?? "Level"}</Text>
            <Ionicons name="chevron-down" size={13} color={level ? colors.accent : colors.muted} />
          </Pressable>
          <Pressable
            style={[styles.filterChip, savedOnly && styles.filterChipActive]}
            onPress={() => setSavedOnly((s) => !s)}
          >
            <Ionicons name={savedOnly ? "heart" : "heart-outline"} size={15} color={savedOnly ? colors.accent : colors.muted} />
            <Text style={[styles.filterText, savedOnly && styles.filterTextActive]}>Saved</Text>
          </Pressable>
        </ScrollView>

        {filtered.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="leaf-outline" size={40} color={colors.mutedForeground} />
            <Text style={styles.emptyText}>
              {savedOnly ? "No saved workouts yet — tap the heart on a workout" : "No workouts match your search"}
            </Text>
          </View>
        ) : (
          <View style={styles.list}>
            {filtered.map((w) => {
              const fav = isFavorite(w.id);
              return (
              <Pressable key={w.id} style={styles.card} onPress={() => router.push(`/workout/${w.id}`)}>
                <ImageBackground source={w.image} style={styles.cardImg} imageStyle={styles.cardImgRadius}>
                  <LinearGradient colors={["rgba(44,36,34,0.05)", "rgba(44,36,34,0.85)"]} style={StyleSheet.absoluteFill} />
                  <Pressable
                    style={styles.cardHeart}
                    hitSlop={8}
                    onPress={(e) => {
                      e.stopPropagation();
                      toggleFavorite(w.id);
                    }}
                  >
                    <Ionicons name={fav ? "heart" : "heart-outline"} size={20} color={fav ? colors.accent : colors.foreground} />
                  </Pressable>
                  <View style={styles.cardBody}>
                    <View style={styles.cardTags}>
                      <Text style={styles.cardCat}>{w.category}</Text>
                      <View style={styles.cardTagDot} />
                      <Text style={styles.cardLevel}>{w.level}</Text>
                    </View>
                    <View>
                      <Text style={styles.cardTitle}>{w.title}</Text>
                      <Text style={styles.cardDesc} numberOfLines={2}>
                        {w.description}
                      </Text>
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
                </ImageBackground>
              </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>

      <Modal visible={picker !== null} transparent animationType="fade" onRequestClose={() => setPicker(null)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setPicker(null)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>{picker === "duration" ? "Duration" : "Level"}</Text>
            {picker === "duration" &&
              DURATION_OPTIONS.map((o) => {
                const on = duration === o.key;
                return (
                  <Pressable
                    key={o.key}
                    style={[styles.sheetRow, on && styles.sheetRowActive]}
                    onPress={() => {
                      setDuration(on ? null : o.key);
                      setPicker(null);
                    }}
                  >
                    <Text style={[styles.sheetRowText, on && styles.sheetRowTextActive]}>{o.label}</Text>
                    {on && <Ionicons name="checkmark" size={18} color={colors.accent} />}
                  </Pressable>
                );
              })}
            {picker === "level" &&
              LEVEL_OPTIONS.map((lvl) => {
                const on = level === lvl;
                return (
                  <Pressable
                    key={lvl}
                    style={[styles.sheetRow, on && styles.sheetRowActive]}
                    onPress={() => {
                      setLevel(on ? null : lvl);
                      setPicker(null);
                    }}
                  >
                    <Text style={[styles.sheetRowText, on && styles.sheetRowTextActive]}>{lvl}</Text>
                    {on && <Ionicons name="checkmark" size={18} color={colors.accent} />}
                  </Pressable>
                );
              })}
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={showFilters} transparent animationType="fade" onRequestClose={() => setShowFilters(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setShowFilters(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeaderRow}>
              <Text style={styles.sheetTitle}>Filters</Text>
              {activeCount > 0 && (
                <Pressable onPress={clearFilters} hitSlop={8}>
                  <Text style={styles.sheetClear}>Clear all</Text>
                </Pressable>
              )}
            </View>

            <Text style={styles.sheetLabel}>Type</Text>
            <View style={styles.chipWrap}>
              {CATEGORIES.map((c) => {
                const on = category === c;
                return (
                  <Pressable
                    key={c}
                    style={[styles.sheetChip, on && styles.sheetChipOn]}
                    onPress={() => setCategory(c)}
                  >
                    <Text style={[styles.sheetChipText, on && styles.sheetChipTextOn]}>{c}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.sheetLabel}>Level</Text>
            <View style={styles.chipWrap}>
              {LEVEL_OPTIONS.map((lvl) => {
                const on = level === lvl;
                return (
                  <Pressable
                    key={lvl}
                    style={[styles.sheetChip, on && styles.sheetChipOn]}
                    onPress={() => setLevel(on ? null : lvl)}
                  >
                    <Text style={[styles.sheetChipText, on && styles.sheetChipTextOn]}>{lvl}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.sheetLabel}>Duration</Text>
            <View style={styles.chipWrap}>
              {DURATION_OPTIONS.map((o) => {
                const on = duration === o.key;
                return (
                  <Pressable
                    key={o.key}
                    style={[styles.sheetChip, on && styles.sheetChipOn]}
                    onPress={() => setDuration(on ? null : o.key)}
                  >
                    <Text style={[styles.sheetChipText, on && styles.sheetChipTextOn]}>{o.label}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Pressable style={styles.sheetApply} onPress={() => setShowFilters(false)}>
              <Text style={styles.sheetApplyText}>
                {filtered.length === WORKOUTS.length
                  ? "Show all workouts"
                  : `Show ${filtered.length} ${filtered.length === 1 ? "workout" : "workouts"}`}
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
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
  headerBtnBadge: {
    position: "absolute",
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  headerBtnBadgeText: { fontFamily: fonts.sansSemibold, fontSize: 11, color: colors.onPrimary },
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
  videoBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: "rgba(201,137,122,0.35)",
    borderRadius: colors.radiusLg,
    padding: 14,
    marginTop: 16,
  },
  videoBannerIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  videoBannerTitle: { fontFamily: fonts.serifSemibold, fontSize: 18, color: colors.foreground },
  videoBannerSub: { fontFamily: fonts.sans, fontSize: 13, color: colors.muted, marginTop: 2 },
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
  cardImg: { height: 200, justifyContent: "space-between" },
  cardImgRadius: { borderRadius: colors.radiusLg },
  cardHeart: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(44,36,34,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  cardBody: { flex: 1, justifyContent: "space-between", padding: 16 },
  cardTags: { flexDirection: "row", alignItems: "center", gap: 8, alignSelf: "flex-start" },
  cardCat: { fontFamily: fonts.sansSemibold, fontSize: 11, color: colors.accent, letterSpacing: 0.6, textTransform: "uppercase" },
  cardTagDot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: "rgba(247,235,232,0.5)" },
  cardLevel: { fontFamily: fonts.sansSemibold, fontSize: 11, color: colors.foreground, letterSpacing: 0.6, textTransform: "uppercase" },
  cardTitle: { fontFamily: fonts.serifSemibold, fontSize: 22, color: colors.foreground },
  cardDesc: { fontFamily: fonts.sans, fontSize: 13, lineHeight: 18, color: "rgba(247,235,232,0.78)", marginTop: 4 },
  cardMeta: { flexDirection: "row", gap: 16, marginTop: 10 },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  metaText: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.foreground },
  empty: { alignItems: "center", paddingVertical: 60, gap: 12 },
  emptyText: { fontFamily: fonts.sans, fontSize: 15, color: colors.muted, textAlign: "center", paddingHorizontal: 32 },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(20,16,15,0.55)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 40,
    gap: 6,
  },
  sheetHandle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: colors.cardBorder, marginBottom: 12 },
  sheetTitle: { fontFamily: fonts.serifSemibold, fontSize: 20, color: colors.foreground, marginBottom: 8 },
  sheetHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sheetClear: { fontFamily: fonts.sansSemibold, fontSize: 14, color: colors.accent },
  sheetLabel: {
    fontFamily: fonts.sansSemibold,
    fontSize: 12,
    color: colors.muted,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginTop: 16,
    marginBottom: 10,
  },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  sheetChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: "transparent",
  },
  sheetChipOn: { borderColor: colors.accent, backgroundColor: "rgba(201,137,122,0.14)" },
  sheetChipText: { fontFamily: fonts.sansMedium, fontSize: 14, color: colors.muted },
  sheetChipTextOn: { color: colors.accent },
  sheetApply: {
    marginTop: 24,
    borderRadius: colors.radius,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
  },
  sheetApplyText: { fontFamily: fonts.sansSemibold, fontSize: 15, color: colors.onPrimary },
  sheetRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 15,
    paddingHorizontal: 16,
    borderRadius: colors.radius,
    borderWidth: 1,
    borderColor: "transparent",
  },
  sheetRowActive: { borderColor: colors.accent, backgroundColor: "rgba(201,137,122,0.14)" },
  sheetRowText: { fontFamily: fonts.sansMedium, fontSize: 15, color: colors.foreground },
  sheetRowTextActive: { color: colors.accent },
});
