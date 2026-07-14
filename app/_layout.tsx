import { useEffect, useState } from "react";
import { Stack } from "expo-router";
import * as Font from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import * as SystemUI from "expo-system-ui";
import { StatusBar } from "expo-status-bar";
import { Image as ExpoImage } from "expo-image";
import { Asset } from "expo-asset";
import { Platform } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  PlayfairDisplay_400Regular,
  PlayfairDisplay_400Regular_Italic,
  PlayfairDisplay_500Medium,
  PlayfairDisplay_500Medium_Italic,
  PlayfairDisplay_600SemiBold,
} from "@expo-google-fonts/playfair-display";
import {
  Figtree_400Regular,
  Figtree_500Medium,
  Figtree_600SemiBold,
  Figtree_700Bold,
} from "@expo-google-fonts/figtree";
import { AuthProvider } from "@/contexts/AuthContext";
import { OnboardingDraftProvider } from "@/contexts/OnboardingDraftContext";
import { DataProvider } from "@/contexts/DataContext";
import { SubscriptionProvider } from "@/contexts/SubscriptionContext";
import { NoticesProvider } from "@/contexts/NoticesContext";
import { NotificationsProvider } from "@/contexts/NotificationsContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { colors } from "@/constants/colors";

SplashScreen.preventAutoHideAsync().catch(() => {});

const queryClient = new QueryClient();

const fontMap: Record<string, number> = {
  PlayfairDisplay_400Regular,
  PlayfairDisplay_400Regular_Italic,
  PlayfairDisplay_500Medium,
  PlayfairDisplay_500Medium_Italic,
  PlayfairDisplay_600SemiBold,
  Figtree_400Regular,
  Figtree_500Medium,
  Figtree_600SemiBold,
  Figtree_700Bold,
};

// Warmed into the image cache while the splash screen is up (alongside fonts),
// so the welcome screen paints its hero on first frame instead of flashing the
// cream background. Tiny (~68KB); failures never block app startup.
const welcomeHeroSource = require("@/assets/images/photos/welcomehero.webp");

export default function RootLayout() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const finish = () => {
      if (!cancelled) setReady(true);
    };

    // Load each font independently and swallow per-font failures. On web, expo-font
    // uses fontfaceobserver, which rejects after 6s for fonts it can't detect (e.g.
    // Cormorant italics) even though the @font-face CSS is already injected and rendering.
    // useFonts batches them with Promise.all, so sibling rejections become unhandled
    // errors (the red overlay). Loading per-font with its own catch avoids that.
    const fontTasks = Object.entries(fontMap).map(([name, mod]) =>
      Font.loadAsync({ [name]: mod }).catch(() => {}),
    );
    // Warm the welcome hero before first paint: resolve the bundled asset's URI
    // (cross-platform via expo-asset), then prime the expo-image cache. A failure
    // (or a platform where this is a no-op) must not block readiness.
    const heroTask = Asset.fromModule(welcomeHeroSource)
      .downloadAsync()
      .then((asset) => {
        const uri = asset.localUri ?? asset.uri;
        return uri ? ExpoImage.prefetch(uri, { cachePolicy: "memory-disk" }) : undefined;
      })
      .catch(() => {});
    Promise.all([...fontTasks, heroTask]).finally(finish);

    // Fallback only on web, where fontfaceobserver can take up to 6s. Native
    // loads bundled TTFs quickly and reliably (failures are caught above), so we
    // gate on actual completion to avoid a flash of fallback typography on cold start.
    const timeout = Platform.OS === "web" ? setTimeout(finish, 2500) : undefined;
    return () => {
      cancelled = true;
      if (timeout) clearTimeout(timeout);
    };
  }, []);

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(colors.background).catch(() => {});
  }, []);

  useEffect(() => {
    if (ready) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [ready]);

  if (!ready) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardProvider>
        <SafeAreaProvider>
          <QueryClientProvider client={queryClient}>
            <ErrorBoundary>
              <OnboardingDraftProvider>
              <AuthProvider>
                <NotificationsProvider>
                <DataProvider>
                  <SubscriptionProvider>
                  <NoticesProvider>
                  <StatusBar style="dark" />
                  <Stack
                    screenOptions={{
                      headerShown: false,
                      contentStyle: { backgroundColor: colors.background },
                    }}
                  >
                    <Stack.Screen
                      name="workout/[id]"
                      options={{ presentation: "fullScreenModal", animation: "slide_from_bottom" }}
                    />
                    <Stack.Screen
                      name="community/compose"
                      options={{ presentation: "modal", animation: "slide_from_bottom" }}
                    />
                    <Stack.Screen name="community/[id]" />
                    <Stack.Screen name="community/notifications" />
                  </Stack>
                  </NoticesProvider>
                  </SubscriptionProvider>
                </DataProvider>
                </NotificationsProvider>
              </AuthProvider>
              </OnboardingDraftProvider>
            </ErrorBoundary>
          </QueryClientProvider>
        </SafeAreaProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}
