import { Platform } from "react-native";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { getApiUrl } from "@/lib/api";

// Client-side device push registration. Pairs with the server in lib/push.ts:
// the server fans a moderation push (warning/block) out to every token a member
// has registered here, so they see it even when the app is closed.
//
// Everything here is native-only and best-effort. Web has no Expo push token, so
// the registration call is a no-op there (the in-app polling in NoticesContext
// still covers the open-app case on every platform).

// Show an alert + play a sound + set the badge when a push arrives while the app
// is foregrounded. Set once at module load so it is in place before any push.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

function isNative(): boolean {
  return Platform.OS === "ios" || Platform.OS === "android";
}

// Resolves the EAS project id push tokens are scoped to. Without it
// getExpoPushTokenAsync throws on a dev/standalone build, so we read it from the
// app config the same way Expo's own templates do.
function getProjectId(): string | undefined {
  const fromExpo = (Constants.expoConfig as any)?.extra?.eas?.projectId;
  const fromEas = (Constants as any)?.easConfig?.projectId;
  return fromExpo || fromEas || undefined;
}

// Asks for permission (if not already granted) and returns the device's Expo
// push token, or null when push is unavailable (web, simulator, denied, or no
// project id). Never throws.
export async function getExpoPushToken(): Promise<string | null> {
  if (!isNative()) return null;
  if (!Device.isDevice) return null;
  try {
    const existing = await Notifications.getPermissionsAsync();
    let status = existing.status;
    if (status !== "granted") {
      const req = await Notifications.requestPermissionsAsync();
      status = req.status;
    }
    if (status !== "granted") return null;

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "Default",
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    const projectId = getProjectId();
    const { data } = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );
    return data || null;
  } catch (e: any) {
    console.warn("getExpoPushToken failed:", e?.message ?? e);
    return null;
  }
}

// Registers this device's push token with the server for the signed-in member.
// Returns the token on success (so the caller can later unregister it), or null
// when push is unavailable. Never throws.
export async function registerForPushNotifications(authToken: string): Promise<string | null> {
  const pushToken = await getExpoPushToken();
  if (!pushToken) return null;
  try {
    const resp = await fetch(`${getApiUrl()}/api/push-register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ token: pushToken, platform: Platform.OS }),
    });
    if (!resp.ok) return null;
    return pushToken;
  } catch {
    return null;
  }
}

// Drops this device's token on sign-out so the member stops receiving pushes on
// a device they have left. Best-effort; never throws.
export async function unregisterPushToken(authToken: string, pushToken: string): Promise<void> {
  try {
    await fetch(
      `${getApiUrl()}/api/push-register?token=${encodeURIComponent(pushToken)}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${authToken}` },
      }
    );
  } catch {
    // ignore
  }
}
