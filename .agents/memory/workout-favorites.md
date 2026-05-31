---
name: Workout favorites mechanism
description: Where workout favoriting (saved workouts) lives and how the library Saved filter depends on it
---

Favoriting workouts is a per-user slice in `DataContext` (`favorites: string[]` of workout ids), persisted via AsyncStorage under the `florish:u:<uid>:favorites` key, exposed as `favorites`, `toggleFavorite(id)`, `isFavorite(id)`.

**Why:** The Workout Library "Saved" filter chip needs a real favoriting source; there was none before (the home screen's "Saved Sessions" still uses `w.featured`, which is unrelated/static).

**How to apply:** Library cards (`app/(tabs)/workouts.tsx`) have a heart overlay that calls `toggleFavorite`. If you want the home screen's saved row to reflect real favorites, switch its `WORKOUTS.filter(w => w.featured)` to use the `favorites` set — currently intentionally left on `featured` to stay in scope.
