import { test } from "node:test";
import assert from "node:assert/strict";

import { RECIPES, RECIPE_CATEGORIES, getRecipe } from "@/constants/recipes";

test("recipe ids are unique", () => {
  const ids = RECIPES.map((r) => r.id);
  assert.equal(new Set(ids).size, ids.length);
});

test("every recipe belongs to a known browse category", () => {
  const cats = new Set<string>(RECIPE_CATEGORIES);
  for (const r of RECIPES) {
    assert.ok(cats.has(r.category), `${r.id} has unknown category "${r.category}"`);
  }
});

test("every browse category has at least one recipe", () => {
  for (const cat of RECIPE_CATEGORIES) {
    assert.ok(
      RECIPES.some((r) => r.category === cat),
      `category "${cat}" is empty`,
    );
  }
});

test("every recipe is complete enough to cook and log", () => {
  for (const r of RECIPES) {
    assert.ok(r.title.trim().length > 0, `${r.id} missing title`);
    assert.ok(r.serves >= 1, `${r.id} serves < 1`);
    assert.ok(r.kcal > 0, `${r.id} kcal not positive`);
    assert.ok(r.protein > 0 && r.carbs > 0 && r.fats > 0, `${r.id} macros not positive`);
    assert.ok(r.ingredients.length >= 3, `${r.id} has fewer than 3 ingredients`);
    assert.ok(r.directions.length >= 2, `${r.id} has fewer than 2 directions`);
    assert.ok(r.tags.length >= 1, `${r.id} has no tags`);
  }
});

test("getRecipe roundtrips by id and misses unknown ids", () => {
  assert.equal(getRecipe(RECIPES[0].id), RECIPES[0]);
  assert.equal(getRecipe("not-a-recipe"), undefined);
});
