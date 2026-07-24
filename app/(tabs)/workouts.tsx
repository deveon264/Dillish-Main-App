import React, { useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable as StructuralPressable, TextInput, Modal, Animated, Keyboard } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { Bouncy as Pressable } from "@/components/Bouncy";
import { ImageBackground } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { GradientBackground } from "@/components/GradientBackground";
import { useScrollDecor } from "@/components/BackgroundDecor";
import { HelpButton } from "@/components/HelpButton";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { useInsets } from "@/hooks/useInsets";
import { useData } from "@/contexts/DataContext";
import { useDataRefresh } from "@/hooks/useDataRefresh";
import { WORKOUTS, CATEGORIES, Workout } from "@/constants/workouts";
import { rankForLibrary } from "@/lib/recommendation";
import { DEFAULT_REST_GAP, workoutDurationMinutes } from "@/lib/workoutDuration";
import type { AppColors } from "@/constants/colors";
import { useColors, useThemedStyles } from "@/hooks/useColors";
import { fonts } from "@/constants/fonts";
import { haptics } from "@/lib/haptics";

type DurationOption = { key: string; label: string; test: (min: number) => boolean };

const DURATION_OPTIONS: DurationOption[] = [
  { key: "short", label: "Under 20 min", test: (m) => m < 20 },
  { key: "medium", label: "20 – 40 min", test: (m) => m >= 20 && m <= 40 },
  { key: "long", label: "Over 40 min", test: (m) => m > 40 },
];

const LEVEL_OPTIONS: Workout["level"][] = ["Beginner", "Intermediate", "Advanced"];

const displayDuration = (workout: Workout) => workoutDurationMinutes(workout.exercises, DEFAULT_REST_GAP);

export default function Workouts() {
  const colors = useColors();
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const insets = useInsets();
  const { favorites, toggleFavorite, isFavorite, profile } = useData();
  const { refreshControl, scrollRef } = useDataRefresh();
  const [category, setCategory] = useState("All");
  const [query, setQuery] = useState("");
  const [duration, setDuration] = useState<string | null>(null);
  const [level, setLevel] = useState<Workout["level"] | null>(null);
  const [savedOnly, setSavedOnly] = useState(false);
  const [forYou, setForYou] = useState(false);
  const [picker, setPicker] = useState<"duration" | "level" | null>(null);
  // Petal texture embedded in the scroll content so it moves with the page.
  const { decor, onContentSizeChange } = useScrollDecor();

  // Floating back-to-top button: fades in once the list is scrolled past the
  // first cards and jumps the ScrollView back to the header/filters.
  const [showTopBtn, setShowTopBtn] = useState(false);
  const topBtnAnim = useRef(new Animated.Value(0)).current;
  const setTopBtnVisible = (visible: boolean) => {
    setShowTopBtn((prev) => {
      if (prev === visible) return prev;
      Animated.timing(topBtnAnim, {
        toValue: visible ? 1 : 0,
        duration: 180,
        useNativeDriver: true,
      }).start();
      return visible;
    });
  };
  const scrollToTop = () => {
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };

  const selectCategory = (next: string) => {
    if (next === category) return;
    haptics.selection();
    setCategory(next);
  };

  const toggleForYou = () => {
    haptics.selection();
    setForYou((value) => !value);
  };

  const toggleSavedOnly = () => {
    haptics.selection();
    setSavedOnly((value) => !value);
  };

  const clearFilters = () => {
    setCategory("All");
    setQuery("");
    setDuration(null);
    setLevel(null);
    setSavedOnly(false);
    setForYou(false);
    setPicker(null);
    Keyboard.dismiss();
  };

  const durationLabel = DURATION_OPTIONS.find((o) => o.key === duration)?.label ?? "Duration";

  const filtered = useMemo(() => {
    const durationTest = DURATION_OPTIONS.find((o) => o.key === duration)?.test;
    const matched = WORKOUTS.filter((w) => {
      const matchCat = category === "All" || w.category === category || w.focusAreas?.includes(category);
      const matchQuery = query.trim() === "" || w.title.toLowerCase().includes(query.trim().toLowerCase());
      const matchDuration = !durationTest || durationTest(displayDuration(w));
      const matchLevel = !level || w.level === level;
      const matchSaved = !savedOnly || favorites.includes(w.id);
      return matchCat && matchQuery && matchDuration && matchLevel && matchSaved;
    });
    // "For You" reorders (never hides): best profile matches first, workouts
    // needing unavailable equipment sink to the bottom.
    return forYou ? rankForLibrary(profile, matched) : matched;
  }, [category, query, duration, level, savedOnly, favorites, forYou, profile]);

  return (
    <GradientBackground showDecor={false}>
      <KeyboardAwareScrollView
        ref={scrollRef}
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 110 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        bottomOffset={72}
        refreshControl={refreshControl}
        onScroll={(e) => setTopBtnVisible(e.nativeEvent.contentOffset.y > 600)}
        scrollEventThrottle={32}
        onContentSizeChange={onContentSizeChange}
      >
        {decor}
        <PageHeader
          eyebrow="EXPLORE"
          title="Workout"
          accent="Library"
          action={
            <HelpButton
              title="Workout Library"
              intro="Find the right session for today and make it your own."
              points={[
                "Browse every class, then filter by type and level to fit your mood.",
                "Switch on For You to bring your best matches first, picked from the goals, level and equipment in your profile.",
                "Save favorites so your go-to workouts are always one tap away.",
                "Tap any workout to start a guided, step-by-step session.",
              ]}
            />
          }
        />

        <View style={styles.search}>
          <Ionicons name="search-outline" size={18} color={colors.mutedForeground} />
          <TextInput
            placeholder="Search workouts"
            placeholderTextColor={colors.mutedForeground}
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
            onSubmitEditing={Keyboard.dismiss}
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
              <Pressable key={c} style={[styles.cat, on && styles.catOn]} onPress={() => selectCategory(c)}>
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
            style={[styles.filterChip, forYou && styles.filterChipActive]}
            onPress={toggleForYou}
          >
            <Ionicons name={forYou ? "sparkles" : "sparkles-outline"} size={15} color={forYou ? colors.accent : colors.muted} />
            <Text style={[styles.filterText, forYou && styles.filterTextActive]}>For You</Text>
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
            onPress={toggleSavedOnly}
          >
            <Ionicons name={savedOnly ? "heart" : "heart-outline"} size={15} color={savedOnly ? colors.accent : colors.muted} />
            <Text style={[styles.filterText, savedOnly && styles.filterTextActive]}>Saved</Text>
          </Pressable>
        </ScrollView>

        {filtered.length === 0 ? (
          <EmptyState
            icon="leaf-outline"
            title={savedOnly ? "No saved workouts yet" : "No workouts found"}
            description={savedOnly ? "Clear the filters to browse the full workout library." : "Try the full library, then narrow it down again."}
            actionLabel="Show all workouts"
            onAction={clearFilters}
          />
        ) : (
          <View style={styles.list}>
            {filtered.map((w) => {
              const fav = isFavorite(w.id);
              return (
              <Pressable pressedScale={0.985} key={w.id} testID={`workout-card-${w.id}`} style={styles.card} onPress={() => router.push(`/workout/${w.id}`)}>
                <ImageBackground
                  source={w.image}
                  style={styles.cardImg}
                  imageStyle={styles.cardImgRadius}
                  contentFit="cover"
                  transition={150}
                  cachePolicy="memory-disk"
                >
                  <LinearGradient
                    colors={["rgba(51,28,38,0.25)", "rgba(51,28,38,0)", "rgba(51,28,38,0)", "rgba(51,28,38,0.82)"]}
                    locations={[0, 0.3, 0.4, 1]}
                    style={StyleSheet.absoluteFill}
                  />
                  <Pressable
                    style={styles.cardHeart}
                    hitSlop={8}
                    onPress={(e) => {
                      e.stopPropagation();
                      haptics.selection();
                      toggleFavorite(w.id);
                    }}
                  >
                    <Ionicons name={fav ? "heart" : "heart-outline"} size={20} color={fav ? colors.accent : "#FFFFFF"} />
                  </Pressable>
                  <View style={styles.cardBody}>
                    <View style={styles.cardTags}>
                      <View style={styles.cardCatPill}>
                        <Text style={styles.cardCat}>{w.category}</Text>
                      </View>
                      <Text style={styles.cardLevel}>{w.level}</Text>
                    </View>
                    <View>
                      <Text style={styles.cardTitle}>{w.title}</Text>
                      <Text style={styles.cardDesc} numberOfLines={2}>
                        {w.description}
                      </Text>
                      <View style={styles.cardMeta}>
                        <View style={styles.metaItem}>
                          <Ionicons name="time-outline" size={14} color="#FFFFFF" />
                          <Text style={styles.metaText}>{displayDuration(w)} min</Text>
                        </View>
                        <View style={styles.metaItem}>
                          <Ionicons name="flame-outline" size={14} color="#FFFFFF" />
                          <Text style={styles.metaText}>~{w.kcal} kcal</Text>
                        </View>
                        <View style={styles.metaItem}>
                          <Ionicons name="person-outline" size={14} color="#FFFFFF" />
                          <Text style={styles.metaText}>With Dillish</Text>
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
      </KeyboardAwareScrollView>

      <Animated.View
        style={[styles.topBtnWrap, { bottom: insets.bottom + 92, opacity: topBtnAnim }]}
        pointerEvents={showTopBtn ? "auto" : "none"}
      >
        <Pressable
          style={styles.topBtn}
          onPress={scrollToTop}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Back to top"
        >
          <Ionicons name="chevron-up" size={20} color={colors.accent} />
        </Pressable>
      </Animated.View>

      <Modal visible={picker !== null} transparent animationType="fade" onRequestClose={() => setPicker(null)}>
        <StructuralPressable style={styles.modalBackdrop} onPress={() => setPicker(null)}>
          <StructuralPressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
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
                      haptics.selection();
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
                      haptics.selection();
                      setLevel(on ? null : lvl);
                      setPicker(null);
                    }}
                  >
                    <Text style={[styles.sheetRowText, on && styles.sheetRowTextActive]}>{lvl}</Text>
                    {on && <Ionicons name="checkmark" size={18} color={colors.accent} />}
                  </Pressable>
                );
              })}
          </StructuralPressable>
        </StructuralPressable>
      </Modal>
    </GradientBackground>
  );
}

const createStyles = (colors: AppColors) => StyleSheet.create({
  topBtnWrap: { position: "absolute", right: 20 },
  topBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.foreground,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 4,
  },
  scroll: { paddingHorizontal: 20 },
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: "rgba(62, 39, 51, 0.1)",
    borderRadius: 16,
    paddingHorizontal: 16,
    minHeight: 50,
    marginTop: 16,
  },
  searchInput: { flex: 1, fontFamily: fonts.sans, fontSize: 15, color: colors.foreground, paddingVertical: 12 },
  cats: { gap: 8, paddingVertical: 16, paddingRight: 8 },
  cat: {
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: "rgba(62, 39, 51, 0.12)",
    backgroundColor: colors.card,
  },
  catOn: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 14,
    elevation: 4,
  },
  catText: { fontFamily: fonts.sansSemibold, fontSize: 13, color: colors.muted },
  catTextOn: { color: colors.onPrimary },
  filters: { gap: 8, paddingBottom: 16, paddingRight: 8 },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(62, 39, 51, 0.1)",
    backgroundColor: colors.card,
  },
  filterChipActive: { borderColor: colors.accentBorderSoft, backgroundColor: colors.blushSurface },
  filterText: { fontFamily: fonts.sansSemibold, fontSize: 12.5, color: "rgba(62, 39, 51, 0.65)" },
  filterTextActive: { color: colors.accent },
  list: { gap: 16 },
  card: {
    borderRadius: colors.radiusLg,
    overflow: "hidden",
    shadowColor: "#3E2733",
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.14,
    shadowRadius: 32,
    elevation: 6,
  },
  cardImg: { height: 300, justifyContent: "space-between" },
  cardImgRadius: { borderRadius: colors.radiusLg },
  cardHeart: {
    position: "absolute",
    top: 14,
    right: 14,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(51, 28, 38, 0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  cardBody: { flex: 1, justifyContent: "space-between", padding: 16 },
  cardTags: { flexDirection: "row", alignItems: "center", gap: 8, alignSelf: "flex-start" },
  cardCatPill: { backgroundColor: colors.primary, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999 },
  cardCat: { fontFamily: fonts.sansBold, fontSize: 10, color: "#FFFFFF", letterSpacing: 1.2, textTransform: "uppercase" },
  cardLevel: {
    fontFamily: fonts.sansBold,
    fontSize: 10,
    color: "rgba(255,255,255,0.85)",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    textShadowColor: "rgba(51,28,38,0.55)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  cardTitle: { fontFamily: fonts.serifMedium, fontSize: 24, lineHeight: 28, color: "#FFFFFF" },
  cardDesc: { fontFamily: fonts.sans, fontSize: 12, lineHeight: 17, color: "rgba(255,255,255,0.8)", marginTop: 4 },
  cardMeta: { flexDirection: "row", gap: 14, marginTop: 8 },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  metaText: { fontFamily: fonts.sansSemibold, fontSize: 11.5, color: "rgba(255,255,255,0.85)" },
  empty: { alignItems: "center", paddingVertical: 60, gap: 12 },
  emptyText: { fontFamily: fonts.sans, fontSize: 15, color: colors.muted, textAlign: "center", paddingHorizontal: 32 },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(16,17,17,0.45)", justifyContent: "flex-end" },
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
  sheetRowActive: { borderColor: colors.accent, backgroundColor: colors.accentTintLg },
  sheetRowText: { fontFamily: fonts.sansMedium, fontSize: 15, color: colors.foreground },
  sheetRowTextActive: { color: colors.accent },
});
