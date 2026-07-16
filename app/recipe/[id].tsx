import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable as StructuralPressable, Modal, ActivityIndicator } from "react-native";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { GradientBackground } from "@/components/GradientBackground";
import { Bouncy as Pressable } from "@/components/Bouncy";
import { Card } from "@/components/Card";
import { SectionLabel } from "@/components/PageHeader";
import { useData } from "@/contexts/DataContext";
import { useInsets } from "@/hooks/useInsets";
import { getRecipe } from "@/constants/recipes";
import { lookupFoodPhoto, rehostStockPhoto } from "@/lib/mealPhotos";
import { addMealWithBackgroundPhoto } from "@/lib/optimisticMeal";
import { recipePhotoCache } from "@/app/recipes";
import type { AppColors } from "@/constants/colors";
import { useColors, useThemedStyles } from "@/hooks/useColors";
import { fonts } from "@/constants/fonts";
import { haptics } from "@/lib/haptics";

const MEALS = ["Breakfast", "Lunch", "Dinner", "Snack"];

export default function RecipeDetail() {
  const colors = useColors();
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const insets = useInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { addCalorie, updateCaloriePhoto, toggleSavedRecipe, isRecipeSaved } = useData();
  const recipe = getRecipe(id ?? "");

  const [photo, setPhoto] = useState<string | null>(recipe ? recipePhotoCache[recipe.id] ?? null : null);
  const [servings, setServings] = useState(1);
  const [mealType, setMealType] = useState("Lunch");
  const [mealMenu, setMealMenu] = useState(false);
  const [logging, setLogging] = useState(false);
  const [logged, setLogged] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    if (recipe && !photo) {
      lookupFoodPhoto(recipe.photoQuery ?? recipe.title).then((url) => {
        if (url && mountedRef.current) {
          recipePhotoCache[recipe.id] = url;
          setPhoto(url);
        }
      });
    }
    return () => {
      mountedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipe?.id]);

  if (!recipe) {
    return (
      <GradientBackground>
        <View style={[styles.missing, { paddingTop: insets.top + 40 }]}>
          <Ionicons name="restaurant-outline" size={36} color={colors.mutedForeground} />
          <Text style={styles.missingText}>Recipe not found</Text>
          <Pressable style={styles.roundBtn} onPress={() => router.back()} hitSlop={8}>
            <Ionicons name="chevron-back" size={22} color={colors.foreground} />
          </Pressable>
        </View>
      </GradientBackground>
    );
  }

  const saved = isRecipeSaved(recipe.id);

  const logToDiary = async () => {
    if (logging || logged) return;
    setLogging(true);
    try {
      // Log the stock URL immediately. Re-hosting is a background durability
      // improvement and must not delay the diary update.
      await addMealWithBackgroundPhoto({
        entry: {
          name: recipe.title,
          kcal: recipe.kcal * servings,
          protein: recipe.protein * servings,
          carbs: recipe.carbs * servings,
          fats: recipe.fats * servings,
          mealType,
        },
        stockPhotoUrl: photo,
        addCalorie,
        updateCaloriePhoto,
        rehostPhoto: rehostStockPhoto,
      });
      haptics.success();
      setLogged(true);
      setTimeout(() => {
        if (mountedRef.current) setLogged(false);
      }, 2200);
    } catch {
      // addCalorie surfaces its own persistence failures via throw; nothing to
      // show beyond leaving the button pressable to retry.
      haptics.warning();
    } finally {
      setLogging(false);
    }
  };

  return (
    <GradientBackground>
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 110 }}
        showsVerticalScrollIndicator={false}
      >
        <View>
          {photo ? (
            <Image source={{ uri: photo }} style={styles.hero} contentFit="cover" transition={200} />
          ) : (
            <View style={[styles.hero, styles.heroFallback]}>
              <Ionicons name="restaurant-outline" size={44} color={colors.accent} />
            </View>
          )}
          <View style={[styles.heroBar, { top: insets.top + 8 }]}>
            <Pressable style={styles.roundBtn} onPress={() => router.back()} hitSlop={8}>
              <Ionicons name="chevron-back" size={22} color={colors.foreground} />
            </Pressable>
            <Pressable
              style={styles.roundBtn}
              onPress={() => {
                haptics.selection();
                toggleSavedRecipe(recipe.id);
              }}
              hitSlop={8}
            >
              <Ionicons
                name={saved ? "bookmark" : "bookmark-outline"}
                size={20}
                color={saved ? colors.accent : colors.foreground}
              />
            </Pressable>
          </View>
        </View>

        <View style={styles.body}>
          <Text style={styles.title}>{recipe.title}</Text>
          <Text style={styles.serves}>Serves {recipe.serves}</Text>

          <View style={styles.chips}>
            {recipe.tags.map((tag) => (
              <View key={tag} style={styles.chip}>
                <Text style={styles.chipText}>{tag}</Text>
              </View>
            ))}
          </View>

          <SectionLabel style={styles.section}>NUTRITION PER SERVING</SectionLabel>
          <Card style={styles.nutritionCard}>
            <View style={styles.kcalWrap}>
              <Text style={styles.kcalNum}>~{recipe.kcal}</Text>
              <Text style={styles.kcalLabel}>kcal</Text>
            </View>
            <View style={styles.macroRow}>
              <MacroTile label="Protein" grams={recipe.protein} color={colors.protein} />
              <MacroTile label="Carbs" grams={recipe.carbs} color={colors.carbs} />
              <MacroTile label="Fats" grams={recipe.fats} color={colors.fats} />
            </View>
          </Card>

          <SectionLabel style={styles.section}>INGREDIENTS</SectionLabel>
          <Card style={styles.listCard}>
            {recipe.ingredients.map((ing, i) => (
              <View key={i} style={[styles.ingRow, i > 0 && styles.rowBorder]}>
                <View style={styles.ingDot} />
                <Text style={styles.ingText}>{ing}</Text>
              </View>
            ))}
          </Card>

          <SectionLabel style={styles.section}>DIRECTIONS</SectionLabel>
          <Card style={styles.listCard}>
            {recipe.directions.map((step, i) => (
              <View key={i} style={[styles.stepRow, i > 0 && styles.rowBorder]}>
                <View style={styles.stepNum}>
                  <Text style={styles.stepNumText}>{i + 1}</Text>
                </View>
                <Text style={styles.stepText}>{step}</Text>
              </View>
            ))}
          </Card>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 14 }]}>
        <Pressable style={styles.mealBtn} onPress={() => setMealMenu(true)} hitSlop={6}>
          <Text style={styles.mealBtnText}>{mealType}</Text>
          <Ionicons name="chevron-down" size={14} color={colors.accentDark} />
        </Pressable>
        <View style={styles.qtyWrap}>
          <Pressable style={styles.qtyBtn} onPress={() => setServings((q) => Math.max(1, q - 1))} hitSlop={6}>
            <Ionicons name="remove" size={16} color={colors.foreground} />
          </Pressable>
          <Text style={styles.qtyText}>{servings}</Text>
          <Pressable style={styles.qtyBtn} onPress={() => setServings((q) => Math.min(20, q + 1))} hitSlop={6}>
            <Ionicons name="add" size={16} color={colors.foreground} />
          </Pressable>
        </View>
        <Pressable style={styles.logBtn} onPress={logToDiary} disabled={logging || logged}>
          <LinearGradient
            colors={colors.gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.logBtnGrad}
          >
            {logging ? (
              <ActivityIndicator size="small" color={colors.onPrimaryStrong} />
            ) : (
              <Ionicons name={logged ? "checkmark" : "add"} size={18} color={colors.onPrimaryStrong} />
            )}
            <Text style={styles.logBtnText}>{logged ? "Logged" : "Log to Diary"}</Text>
          </LinearGradient>
        </Pressable>
      </View>

      <Modal visible={mealMenu} transparent animationType="fade" onRequestClose={() => setMealMenu(false)}>
        <StructuralPressable style={styles.menuBackdrop} onPress={() => setMealMenu(false)}>
          <View style={styles.menuCard}>
            {MEALS.map((m) => (
              <Pressable
                key={m}
                style={styles.menuRow}
                onPress={() => {
                  if (mealType !== m) haptics.selection();
                  setMealType(m);
                  setMealMenu(false);
                }}
              >
                <Text style={[styles.menuText, m === mealType && { color: colors.accent }]}>{m}</Text>
                {m === mealType ? <Ionicons name="checkmark" size={16} color={colors.accent} /> : null}
              </Pressable>
            ))}
          </View>
        </StructuralPressable>
      </Modal>
    </GradientBackground>
  );
}

function MacroTile({ label, grams, color }: { label: string; grams: number; color: string }) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.macroTile}>
      <View style={[styles.macroDot, { backgroundColor: color }]} />
      <Text style={styles.macroGrams}>{grams} g</Text>
      <Text style={styles.macroLabel}>{label}</Text>
    </View>
  );
}

const createStyles = (colors: AppColors) => StyleSheet.create({
  hero: { width: "100%", height: 280 },
  heroFallback: { backgroundColor: colors.accentTint, alignItems: "center", justifyContent: "center" },
  heroBar: {
    position: "absolute",
    left: 16,
    right: 16,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  roundBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
  },
  body: { paddingHorizontal: 20 },
  title: { fontFamily: fonts.serifMedium, fontSize: 28, lineHeight: 34, color: colors.foreground, marginTop: 18 },
  serves: { fontFamily: fonts.sans, fontSize: 14, color: colors.muted, marginTop: 4 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  chip: {
    borderWidth: 1,
    borderColor: colors.accentBorderSoft,
    backgroundColor: colors.accentTintFaint,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipText: { fontFamily: fonts.sansMedium, fontSize: 12, color: colors.accentDark },
  section: { marginTop: 24, marginBottom: 10 },
  nutritionCard: { flexDirection: "row", alignItems: "center", gap: 18, padding: 16 },
  kcalWrap: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 3,
    borderColor: colors.accentTintLg,
    alignItems: "center",
    justifyContent: "center",
  },
  kcalNum: { fontFamily: fonts.serifSemibold, fontSize: 24, color: colors.foreground },
  kcalLabel: { fontFamily: fonts.sans, fontSize: 11, color: colors.mutedForeground },
  macroRow: { flex: 1, flexDirection: "row", justifyContent: "space-between" },
  macroTile: { alignItems: "center", gap: 3 },
  macroDot: { width: 8, height: 8, borderRadius: 4 },
  macroGrams: { fontFamily: fonts.sansSemibold, fontSize: 15, color: colors.foreground },
  macroLabel: { fontFamily: fonts.sans, fontSize: 11, color: colors.mutedForeground },
  listCard: { paddingHorizontal: 16, paddingVertical: 4 },
  ingRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, paddingVertical: 11 },
  rowBorder: { borderTopWidth: 1, borderTopColor: colors.cardBorder },
  ingDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.accent, marginTop: 7 },
  ingText: { flex: 1, fontFamily: fonts.sans, fontSize: 14, lineHeight: 20, color: colors.foreground },
  stepRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingVertical: 12 },
  stepNum: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.accentTint,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  stepNumText: { fontFamily: fonts.sansBold, fontSize: 12, color: colors.accentDark },
  stepText: { flex: 1, fontFamily: fonts.sans, fontSize: 14, lineHeight: 21, color: colors.foreground },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
  },
  mealBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderColor: colors.accentBorderSoft,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  mealBtnText: { fontFamily: fonts.sansSemibold, fontSize: 13, color: colors.accentDark },
  qtyWrap: { flexDirection: "row", alignItems: "center", gap: 8 },
  qtyBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  qtyText: { fontFamily: fonts.sansSemibold, fontSize: 15, color: colors.foreground, minWidth: 18, textAlign: "center" },
  logBtn: { flex: 1 },
  logBtnGrad: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: 999,
    paddingVertical: 14,
  },
  logBtnText: { fontFamily: fonts.sansSemibold, fontSize: 15, color: colors.onPrimaryStrong },
  menuBackdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  menuCard: {
    width: "100%",
    maxWidth: 320,
    backgroundColor: colors.card,
    borderRadius: colors.radius,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 13,
    paddingHorizontal: 12,
  },
  menuText: { fontFamily: fonts.sansMedium, fontSize: 15, color: colors.foreground },
  missing: { flex: 1, alignItems: "center", gap: 14 },
  missingText: { fontFamily: fonts.sansMedium, fontSize: 15, color: colors.muted },
});
