import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { getJSON, setJSON, genId } from "@/lib/storage";
import { isAdminEmail } from "@/constants/admin";

export type User = {
  id: string;
  name: string;
  email: string;
  onboardingComplete: boolean;
};

type StoredUser = User & { password: string };

type AuthContextType = {
  user: User | null;
  isAdmin: boolean;
  loading: boolean;
  signup: (name: string, email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => Promise<void>;
  completeOnboarding: () => Promise<void>;
  updateUser: (patch: Partial<Pick<User, "name" | "email">>) => Promise<void>;
};

const USERS_KEY = "florish:users";
const SESSION_KEY = "florish_session";

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const isWeb = Platform.OS === "web";

async function getSession(): Promise<string | null> {
  try {
    if (isWeb) return await AsyncStorage.getItem(SESSION_KEY);
    return await SecureStore.getItemAsync(SESSION_KEY);
  } catch {
    return null;
  }
}
async function setSession(id: string): Promise<void> {
  try {
    if (isWeb) await AsyncStorage.setItem(SESSION_KEY, id);
    else await SecureStore.setItemAsync(SESSION_KEY, id);
  } catch {
    // ignore
  }
}
async function clearSession(): Promise<void> {
  try {
    if (isWeb) await AsyncStorage.removeItem(SESSION_KEY);
    else await SecureStore.deleteItemAsync(SESSION_KEY);
  } catch {
    // ignore
  }
}

function publicUser(u: StoredUser): User {
  return { id: u.id, name: u.name, email: u.email, onboardingComplete: u.onboardingComplete };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const userIdRef = useRef<string | null>(null);

  useEffect(() => {
    userIdRef.current = user?.id ?? null;
  }, [user]);

  useEffect(() => {
    (async () => {
      const id = await getSession();
      if (id) {
        const users = await getJSON<StoredUser[]>(USERS_KEY, []);
        const found = users.find((u) => u.id === id);
        if (found) setUser(publicUser(found));
      }
      setLoading(false);
    })();
  }, []);

  const signup = useCallback(async (name: string, email: string, password: string) => {
    const trimmed = email.trim().toLowerCase();
    if (!name.trim()) return { ok: false, error: "Please enter your name" };
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(trimmed)) return { ok: false, error: "Enter a valid email" };
    if (password.length < 6) return { ok: false, error: "Password must be at least 6 characters" };

    const users = await getJSON<StoredUser[]>(USERS_KEY, []);
    if (users.some((u) => u.email === trimmed)) {
      return { ok: false, error: "An account with this email already exists" };
    }
    const newUser: StoredUser = {
      id: genId(),
      name: name.trim(),
      email: trimmed,
      password,
      onboardingComplete: false,
    };
    await setJSON(USERS_KEY, [...users, newUser]);
    await setSession(newUser.id);
    setUser(publicUser(newUser));
    return { ok: true };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const trimmed = email.trim().toLowerCase();
    const users = await getJSON<StoredUser[]>(USERS_KEY, []);
    const found = users.find((u) => u.email === trimmed);
    if (!found || found.password !== password) {
      return { ok: false, error: "Incorrect email or password" };
    }
    await setSession(found.id);
    setUser(publicUser(found));
    return { ok: true };
  }, []);

  const logout = useCallback(async () => {
    await clearSession();
    setUser(null);
  }, []);

  const persistPatch = useCallback(async (patch: Partial<StoredUser>) => {
    setUser((prev) => (prev ? { ...prev, ...patch } : prev));
    const id = userIdRef.current ?? (await getSession());
    if (!id) return;
    const users = await getJSON<StoredUser[]>(USERS_KEY, []);
    const next = users.map((u) => (u.id === id ? { ...u, ...patch } : u));
    await setJSON(USERS_KEY, next);
  }, []);

  const completeOnboarding = useCallback(async () => {
    await persistPatch({ onboardingComplete: true });
  }, [persistPatch]);

  const updateUser = useCallback(
    async (patch: Partial<Pick<User, "name" | "email">>) => {
      const clean: Partial<StoredUser> = {};
      if (patch.name != null) clean.name = patch.name;
      if (patch.email != null) clean.email = patch.email.trim().toLowerCase();
      await persistPatch(clean);
    },
    [persistPatch]
  );

  return (
    <AuthContext.Provider
      value={{ user, isAdmin: isAdminEmail(user?.email), loading, signup, login, logout, completeOnboarding, updateUser }}
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
