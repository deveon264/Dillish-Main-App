import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { getApiUrl } from "@/lib/api";

// Client-side storage and retrieval of the server-signed admin (coach) token.
// The token — not the coach's email — is what authorizes uploads and deletes.

const TOKEN_KEY = "florish_admin_token";
const EXP_KEY = "florish_admin_token_exp";
const isWeb = Platform.OS === "web";

async function readItem(key: string): Promise<string | null> {
  try {
    if (isWeb) return await AsyncStorage.getItem(key);
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

async function writeItem(key: string, value: string): Promise<void> {
  try {
    if (isWeb) await AsyncStorage.setItem(key, value);
    else await SecureStore.setItemAsync(key, value);
  } catch {
    // ignore
  }
}

async function deleteItem(key: string): Promise<void> {
  try {
    if (isWeb) await AsyncStorage.removeItem(key);
    else await SecureStore.deleteItemAsync(key);
  } catch {
    // ignore
  }
}

// Returns a still-valid stored token, or null if missing/expired.
export async function getAdminToken(): Promise<string | null> {
  const token = await readItem(TOKEN_KEY);
  if (!token) return null;
  const exp = Number((await readItem(EXP_KEY)) ?? "0");
  // Treat tokens within 60s of expiry as already expired.
  if (!exp || exp - 60_000 < Date.now()) {
    await clearAdminToken();
    return null;
  }
  return token;
}

export async function clearAdminToken(): Promise<void> {
  await deleteItem(TOKEN_KEY);
  await deleteItem(EXP_KEY);
}

// Exchanges the coach passcode for a signed token and stores it. Returns the
// token on success.
export async function unlockAdmin(
  passcode: string
): Promise<{ ok: boolean; token?: string; error?: string }> {
  try {
    const resp = await fetch(`${getApiUrl()}/api/admin-session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ passcode }),
    });
    if (!resp.ok) {
      let error = "Could not unlock coach tools";
      try {
        const j = await resp.json();
        if (j?.error) error = j.error;
      } catch {
        // ignore
      }
      return { ok: false, error };
    }
    const data = (await resp.json()) as { token: string; expiresAt: number };
    await writeItem(TOKEN_KEY, data.token);
    await writeItem(EXP_KEY, String(data.expiresAt));
    return { ok: true, token: data.token };
  } catch {
    return { ok: false, error: "Network error. Please try again." };
  }
}
