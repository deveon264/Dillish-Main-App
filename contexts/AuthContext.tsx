import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { getJSON } from "@/lib/storage";
import { getApiUrl } from "@/lib/api";
import { isAdminEmail } from "@/constants/admin";

export type User = {
  id: string;
  name: string;
  email: string;
  avatar?: string | null;
  isAdmin: boolean;
  onboardingComplete: boolean;
};

export type UserUpdate = { name?: string; email?: string; avatar?: string | null };

// Pre-server (on-device mock) account shape, kept only so existing users can be
// migrated to the server on their next login.
type LegacyStoredUser = {
  id: string;
  name: string;
  email: string;
  password: string;
  avatar?: string;
  onboardingComplete: boolean;
};

type AuthResult = { ok: boolean; error?: string };

type AuthContextType = {
  user: User | null;
  isAdmin: boolean;
  adminUnlocked: boolean;
  adminToken: string | null;
  loading: boolean;
  signup: (name: string, email: string, password: string, passcode?: string) => Promise<AuthResult>;
  login: (email: string, password: string) => Promise<AuthResult>;
  requestPasswordReset: (email: string) => Promise<{ ok: boolean; token?: string; error?: string }>;
  resetPassword: (token: string, password: string) => Promise<AuthResult>;
  logout: () => Promise<void>;
  completeOnboarding: () => Promise<void>;
  updateUser: (patch: UserUpdate) => Promise<AuthResult>;
};

const LEGACY_USERS_KEY = "florish:users";
const TOKEN_KEY = "florish_session";

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const isWeb = Platform.OS === "web";
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

async function readToken(): Promise<string | null> {
  try {
    if (isWeb) return await AsyncStorage.getItem(TOKEN_KEY);
    return await SecureStore.getItemAsync(TOKEN_KEY);
  } catch {
    return null;
  }
}
async function writeToken(token: string): Promise<void> {
  try {
    if (isWeb) await AsyncStorage.setItem(TOKEN_KEY, token);
    else await SecureStore.setItemAsync(TOKEN_KEY, token);
  } catch {
    // ignore
  }
}
async function deleteToken(): Promise<void> {
  try {
    if (isWeb) await AsyncStorage.removeItem(TOKEN_KEY);
    else await SecureStore.deleteItemAsync(TOKEN_KEY);
  } catch {
    // ignore
  }
}

async function postJSON(path: string, body: unknown): Promise<{ ok: boolean; status: number; data: any }> {
  try {
    const resp = await fetch(`${getApiUrl()}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    let data: any = null;
    try {
      data = await resp.json();
    } catch {
      // ignore
    }
    return { ok: resp.ok, status: resp.status, data };
  } catch {
    return { ok: false, status: 0, data: null };
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Restore the session from the stored token by re-verifying it server-side.
  useEffect(() => {
    (async () => {
      const stored = await readToken();
      if (stored) {
        try {
          const resp = await fetch(`${getApiUrl()}/api/me`, {
            headers: { Authorization: `Bearer ${stored}` },
          });
          if (resp.ok) {
            const { user: u } = (await resp.json()) as { user: User };
            setUser(u);
            setToken(stored);
          } else if (resp.status === 401 || resp.status === 404) {
            // Token is invalid/expired or the account is gone — drop it.
            await deleteToken();
          }
          // On a transient (5xx/network) error keep the token so a later launch
          // can retry rather than silently logging the user out.
        } catch {
          // network error: leave the token in place for a future retry
        }
      }
      setLoading(false);
    })();
  }, []);

  const applySession = useCallback(async (u: User, t: string) => {
    await writeToken(t);
    setToken(t);
    setUser(u);
  }, []);

  const signup = useCallback(
    async (name: string, email: string, password: string, passcode?: string): Promise<AuthResult> => {
      const res = await postJSON("/api/signup", {
        name,
        email,
        password,
        ...(passcode ? { passcode } : {}),
      });
      if (res.ok && res.data?.user && res.data?.token) {
        await applySession(res.data.user as User, res.data.token as string);
        return { ok: true };
      }
      if (res.status === 0) return { ok: false, error: "Network error. Please try again." };
      return { ok: false, error: res.data?.error ?? "Unable to create account" };
    },
    [applySession]
  );

  // Transparently migrates a pre-server (on-device) account to the server the
  // first time the user signs in with the same credentials. The coach email is
  // excluded — claiming admin always requires the passcode via signup.
  const migrateLegacy = useCallback(
    async (email: string, password: string): Promise<AuthResult | null> => {
      const trimmed = email.trim().toLowerCase();
      if (isAdminEmail(trimmed)) return null;
      const legacy = await getJSON<LegacyStoredUser[]>(LEGACY_USERS_KEY, []);
      const match = legacy.find((u) => u.email === trimmed && u.password === password);
      if (!match) return null;

      const res = await postJSON("/api/signup", { name: match.name, email: trimmed, password });
      if (res.ok && res.data?.user && res.data?.token) {
        let migrated = res.data.user as User;
        const t = res.data.token as string;
        // Carry over the only on-device account state the server tracks.
        if (match.onboardingComplete) {
          const patched = await fetch(`${getApiUrl()}/api/me`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
            body: JSON.stringify({ onboardingComplete: true }),
          }).catch(() => null);
          if (patched?.ok) {
            try {
              migrated = ((await patched.json()) as { user: User }).user;
            } catch {
              // keep the un-patched user
            }
          }
        }
        await applySession(migrated, t);
        return { ok: true };
      }
      // Account already exists server-side (so the password was simply wrong),
      // or migration failed — let the caller surface the original login error.
      return null;
    },
    [applySession]
  );

  const login = useCallback(
    async (email: string, password: string): Promise<AuthResult> => {
      const res = await postJSON("/api/login", { email, password });
      if (res.ok && res.data?.user && res.data?.token) {
        await applySession(res.data.user as User, res.data.token as string);
        return { ok: true };
      }
      if (res.status === 0) return { ok: false, error: "Network error. Please try again." };
      // Unknown account? Try migrating a matching on-device account.
      const migrated = await migrateLegacy(email, password);
      if (migrated) return migrated;
      return { ok: false, error: res.data?.error ?? "Unable to sign in" };
    },
    [applySession, migrateLegacy]
  );

  // Starts a reset for the given email. On success the server returns a reset
  // token (no email channel yet) which the caller passes to resetPassword. The
  // response is generic, so an unknown email also resolves ok but without a
  // token — the UI shows the same message either way.
  const requestPasswordReset = useCallback(
    async (email: string): Promise<{ ok: boolean; token?: string; error?: string }> => {
      const trimmed = email.trim().toLowerCase();
      if (!EMAIL_RE.test(trimmed)) return { ok: false, error: "Enter a valid email" };
      const res = await postJSON("/api/password-reset-request", { email: trimmed });
      if (res.status === 0) return { ok: false, error: "Network error. Please try again." };
      if (res.ok) return { ok: true, token: res.data?.token as string | undefined };
      return { ok: false, error: res.data?.error ?? "Could not start password reset" };
    },
    []
  );

  // Completes a reset with the token from requestPasswordReset and signs the
  // member straight in on success.
  const resetPassword = useCallback(
    async (resetToken: string, password: string): Promise<AuthResult> => {
      const res = await postJSON("/api/password-reset-complete", { token: resetToken, password });
      if (res.ok && res.data?.user && res.data?.token) {
        await applySession(res.data.user as User, res.data.token as string);
        return { ok: true };
      }
      if (res.status === 0) return { ok: false, error: "Network error. Please try again." };
      return { ok: false, error: res.data?.error ?? "Could not reset password" };
    },
    [applySession]
  );

  const logout = useCallback(async () => {
    await deleteToken();
    setToken(null);
    setUser(null);
  }, []);

  const patchMe = useCallback(
    async (patch: Record<string, unknown>): Promise<{ ok: boolean; status: number; data: any }> => {
      if (!token) return { ok: false, status: 401, data: null };
      try {
        const resp = await fetch(`${getApiUrl()}/api/me`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify(patch),
        });
        let data: any = null;
        try {
          data = await resp.json();
        } catch {
          // ignore
        }
        if (resp.ok && data?.user) setUser(data.user as User);
        return { ok: resp.ok, status: resp.status, data };
      } catch {
        return { ok: false, status: 0, data: null };
      }
    },
    [token]
  );

  const completeOnboarding = useCallback(async () => {
    const res = await patchMe({ onboardingComplete: true });
    // Reflect it locally even if the network call failed, so the user isn't
    // bounced back into onboarding; the server retries on the next profile save.
    if (!res.ok) setUser((prev) => (prev ? { ...prev, onboardingComplete: true } : prev));
  }, [patchMe]);

  const updateUser = useCallback(
    async (patch: UserUpdate): Promise<AuthResult> => {
      const payload: Record<string, unknown> = {};
      if (patch.name != null) payload.name = patch.name.trim();
      if (patch.email != null) {
        const trimmed = patch.email.trim().toLowerCase();
        if (!EMAIL_RE.test(trimmed)) return { ok: false, error: "Enter a valid email" };
        payload.email = trimmed;
      }
      if ("avatar" in patch) payload.avatar = patch.avatar ?? null;
      const res = await patchMe(payload);
      if (res.ok) return { ok: true };
      if (res.status === 0) return { ok: false, error: "Network error. Please try again." };
      return { ok: false, error: res.data?.error ?? "Could not save changes" };
    },
    [patchMe]
  );

  const isAdmin = !!user?.isAdmin;

  return (
    <AuthContext.Provider
      value={{
        user,
        isAdmin,
        // The coach is recognized by their verified login — no passcode step.
        adminUnlocked: isAdmin,
        // The admin's session token doubles as the admin token for upload/delete.
        adminToken: isAdmin ? token : null,
        loading,
        signup,
        login,
        requestPasswordReset,
        resetPassword,
        logout,
        completeOnboarding,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
