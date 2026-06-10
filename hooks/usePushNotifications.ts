import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import { router } from "expo-router";
import * as Notifications from "expo-notifications";
import {
  registerForPushNotifications,
  unregisterPushToken,
} from "@/lib/pushClient";

// Wires device push notifications to the signed-in member:
// - registers the device token on login (so the server can reach them when the
//   app is closed) and de-registers it on logout,
// - opens the community feed when a moderation push is tapped (that is where the
//   notice and acknowledge action live),
// - refreshes the in-app notices when a push arrives in the foreground, so the
//   tab badge updates immediately.
//
// Native-only: on web there is no Expo push token, so registration no-ops and
// no listeners are attached.
export function usePushNotifications(opts: {
  authToken: string | null;
  onModerationPush: () => void;
}): void {
  const { authToken, onModerationPush } = opts;

  // Hold the latest moderation handler in a ref so the listener effect can stay
  // mounted once without re-subscribing on every render.
  const onPushRef = useRef(onModerationPush);
  useEffect(() => {
    onPushRef.current = onModerationPush;
  }, [onModerationPush]);

  // The expo token and the auth token it was registered with, so logout can
  // de-register the right device even after the auth token is cleared locally
  // (the signed token itself is still valid server-side until it expires).
  const pushTokenRef = useRef<string | null>(null);
  const registeredAuthRef = useRef<string | null>(null);

  // Register on login, de-register on logout.
  useEffect(() => {
    if (Platform.OS === "web") return;
    let cancelled = false;

    if (authToken) {
      // Already registered for this exact session token? Nothing to do.
      if (registeredAuthRef.current === authToken) return;
      (async () => {
        const pushToken = await registerForPushNotifications(authToken);
        if (cancelled || !pushToken) return;
        pushTokenRef.current = pushToken;
        registeredAuthRef.current = authToken;
      })();
    } else {
      const pushToken = pushTokenRef.current;
      const prevAuth = registeredAuthRef.current;
      pushTokenRef.current = null;
      registeredAuthRef.current = null;
      if (pushToken && prevAuth) {
        unregisterPushToken(prevAuth, pushToken).catch(() => {});
      }
    }

    return () => {
      cancelled = true;
    };
  }, [authToken]);

  // Route a tapped moderation push to the community feed, and refresh notices
  // when one arrives in the foreground. Mounted once for the app's lifetime.
  useEffect(() => {
    if (Platform.OS === "web") return;

    const isModeration = (resp: Notifications.NotificationResponse | null): boolean => {
      const data = resp?.notification?.request?.content?.data as
        | { type?: string }
        | undefined;
      return data?.type === "moderation";
    };

    // Cold start: the app was launched by tapping a push.
    Notifications.getLastNotificationResponseAsync()
      .then((resp) => {
        if (isModeration(resp)) {
          onPushRef.current();
          router.navigate("/community");
        }
      })
      .catch(() => {});

    const tapSub = Notifications.addNotificationResponseReceivedListener((resp) => {
      if (isModeration(resp)) {
        onPushRef.current();
        router.navigate("/community");
      }
    });

    const receiveSub = Notifications.addNotificationReceivedListener((notification) => {
      const data = notification?.request?.content?.data as { type?: string } | undefined;
      if (data?.type === "moderation") onPushRef.current();
    });

    return () => {
      tapSub.remove();
      receiveSub.remove();
    };
  }, []);
}
