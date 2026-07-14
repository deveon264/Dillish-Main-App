import { useEffect, useRef } from "react";
import { useNavigation } from "expo-router";
import { useScrollToTop } from "@react-navigation/native";

// Wires the standard "tap the active tab" behaviors to a bottom-tab screen's
// scrollable. A single tap on the already-focused tab scrolls it back to the top
// (via useScrollToTop, which listens for the TabBar's `tabPress` event), and a
// quick double-tap on that tab calls `onDoublePress` (used for refresh).
//
// The returned ref is attached to the screen's ScrollView/FlatList. `onDoublePress`
// should be a stable callback (useCallback) so the tabPress listener isn't
// re-subscribed on every render.
export function useActiveTabScroll(onDoublePress?: () => void) {
  // `any` bridges ScrollView and FlatList refs — useScrollToTop accepts either.
  const ref = useRef<any>(null);
  useScrollToTop(ref);

  const navigation = useNavigation();
  const lastPress = useRef(0);

  useEffect(() => {
    if (!onDoublePress) return;
    // `tabPress` fires for this screen's tab; only act when the tab is already
    // active (a press that switches TO the tab is a navigation, not a refresh).
    const unsub = (navigation as any).addListener("tabPress", () => {
      if (!navigation.isFocused()) return;
      const now = Date.now();
      if (now - lastPress.current < 350) onDoublePress();
      lastPress.current = now;
    });
    return unsub;
  }, [navigation, onDoublePress]);

  return ref;
}
