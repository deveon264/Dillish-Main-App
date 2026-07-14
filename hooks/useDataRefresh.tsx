import React, { useCallback, useState } from "react";
import { RefreshControl } from "react-native";
import { useData } from "@/contexts/DataContext";
import { useActiveTabScroll } from "@/hooks/useActiveTabScroll";
import type { AppColors } from "@/constants/colors";
import { useColors, useThemedStyles } from "@/hooks/useColors";

// Shared pull-to-refresh for the bottom-tab screens. Re-syncs DataContext (the
// local caches + the server profile) via `reload`, which is silent so the UI
// never blanks mid-gesture. Returns a ready-made RefreshControl element to hand
// straight to a ScrollView/FlatList `refreshControl` prop, so each screen only
// imports this hook instead of repeating the state + control wiring.
export function useDataRefresh() {
  const colors = useColors();
  const { reload } = useData();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await reload();
    } finally {
      setRefreshing(false);
    }
  }, [reload]);

  // Attach to the screen's ScrollView so tapping the active tab scrolls to top
  // and double-tapping it triggers the same refresh (with the spinner showing).
  const scrollRef = useActiveTabScroll(onRefresh);

  const refreshControl = (
    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
  );

  return { refreshing, onRefresh, refreshControl, scrollRef };
}
