import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { Bouncy as Pressable } from "@/components/Bouncy";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { GradientBackground } from "@/components/GradientBackground";
import { PageHeader, SectionLabel } from "@/components/PageHeader";
import { useData } from "@/contexts/DataContext";
import { useInsets } from "@/hooks/useInsets";
import { RECIPES, RECIPE_CATEGORIES, type Recipe } from "@/constants/recipes";
import { lookupFoodPhoto } from "@/lib/mealPhotos";
import type { AppColors } from "@/constants/colors";
import { useColors, useThemedStyles } from "@/hooks/useColors";
import { fonts } from "@/constants/fonts";
import { haptics } from "@/lib/haptics";

// Stock photos are looked up once per recipe and shared across the browser and
// the detail screen for the app's lifetime, so category rows never re-fetch.
export const recipePhotoCache: Record<string, string> = {};

function RecipeCard({ recipe }: { recipe: Recipe }) {
  const colors = useColors();
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const { toggleSavedRecipe, isRecipeSaved } = useData();
  const [photo, setPhoto] = useState<string | null>(recipePhotoCache[recipe.id] ?? null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    if (!photo) {
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
  }, [recipe.id]);

  const saved = isRecipeSaved(recipe.id);

  return (
    <Pressable
      pressedScale={0.985}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.9 }]}
      onPress={() => router.push({ pathname: "/recipe/[id]", params: { id: recipe.id } })}
    >
      {photo ? (
        <Image source={{ uri: photo }} style={styles.cardImage} contentFit="cover" transition={150} />
      ) : (
        <View style={[styles.cardImage, styles.cardImageFallback]}>
          <Ionicons name="restaurant-outline" size={26} color={colors.accent} />
        </View>
      )}
      <Text style={styles.cardTitle} numberOfLines={2}>
        {recipe.title}
      </Text>
      <View style={styles.cardFoot}>
        <Text style={styles.cardKcal}>{recipe.kcal} kcal</Text>
        <Pressable
          hitSlop={10}
          onPress={() => {
            haptics.selection();
            toggleSavedRecipe(recipe.id);
          }}
        >
          <Ionicons
            name={saved ? "bookmark" : "bookmark-outline"}
            size={17}
            color={saved ? colors.accent : colors.mutedForeground}
          />
        </Pressable>
      </View>
    </Pressable>
  );
}

function CategoryRow({ title, recipes }: { title: string; recipes: Recipe[] }) {
  const styles = useThemedStyles(createStyles);
  if (recipes.length === 0) return null;
  return (
    <View style={styles.sectionWrap}>
      <SectionLabel style={styles.sectionLabel}>{title.toUpperCase()}</SectionLabel>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {recipes.map((r) => (
          <RecipeCard key={r.id} recipe={r} />
        ))}
      </ScrollView>
    </View>
  );
}

export default function RecipesBrowser() {
  const colors = useColors();
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const insets = useInsets();
  const { savedRecipes } = useData();

  const saved = RECIPES.filter((r) => savedRecipes.includes(r.id));

  return (
    <GradientBackground>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        <PageHeader
          variant="compact"
          eyebrow="NOURISH"
          title="Recipe"
          accent="Ideas"
          leading={
            <Pressable style={styles.roundBtn} onPress={() => router.back()} hitSlop={8}>
              <Ionicons name="chevron-back" size={22} color={colors.foreground} />
            </Pressable>
          }
        />

        <Text style={styles.intro}>
          Dietitian-style meals with full nutrition, ingredients, and directions. Tap any card to cook it or log it
          straight to your diary.
        </Text>

        {saved.length > 0 ? <CategoryRow title="Saved" recipes={saved} /> : null}
        {RECIPE_CATEGORIES.map((cat) => (
          <CategoryRow key={cat} title={cat} recipes={RECIPES.filter((r) => r.category === cat)} />
        ))}
      </ScrollView>
    </GradientBackground>
  );
}

const createStyles = (colors: AppColors) => StyleSheet.create({
  scroll: { paddingHorizontal: 20 },
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
  intro: { fontFamily: fonts.sans, fontSize: 14, lineHeight: 21, color: colors.muted, marginTop: 12 },
  sectionWrap: { marginTop: 22 },
  sectionLabel: { marginBottom: 12 },
  row: { gap: 12, paddingRight: 8 },
  card: {
    width: 170,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: colors.radius,
    padding: 10,
  },
  cardImage: { width: "100%", height: 110, borderRadius: colors.radiusSm },
  cardImageFallback: {
    backgroundColor: colors.accentTint,
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: {
    fontFamily: fonts.sansSemibold,
    fontSize: 14,
    lineHeight: 19,
    color: colors.foreground,
    marginTop: 10,
    minHeight: 38,
  },
  cardFoot: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
  },
  cardKcal: { fontFamily: fonts.sans, fontSize: 12, color: colors.mutedForeground },
});
