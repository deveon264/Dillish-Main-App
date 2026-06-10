import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { AppState } from "react-native";
import { useAuth } from "@/contexts/AuthContext";
import { fetchNotifications } from "@/lib/community";

// Lightweight shared state for the in-app notification badge. The unread count
// lives here (not on a single screen) so the Circle tab badge, the feed header
// bell, and the inbox can all read and refresh the same number. The actual
// notification list is fetched by the inbox screen itself; this context only
// tracks the unread count that drives the badge.
type NotificationsContextType = {
  unreadCount: number;
  // Re-fetches the unread count from the server.
  refreshUnread: () => Promise<void>;
  // Sets the count directly (e.g. the inbox already learned the new count when
  // it marked notifications read, so it can update the badge without a refetch).
  setUnreadCount: (n: number) => void;
};

const NotificationsContext = createContext<NotificationsContextType | undefined>(undefined);

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  const refreshUnread = useCallback(async () => {
    if (!token) {
      setUnreadCount(0);
      return;
    }
    try {
      const { unreadCount: count } = await fetchNotifications({ token });
      setUnreadCount(count);
    } catch {
      // A failed badge refresh should never disrupt the app; leave the count.
    }
  }, [token]);

  // Refresh whenever the signed-in member changes (login/logout) and whenever
  // the app returns to the foreground, so the badge is current on resume.
  useEffect(() => {
    refreshUnread();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") refreshUnread();
    });
    return () => sub.remove();
  }, [refreshUnread]);

  return (
    <NotificationsContext.Provider value={{ unreadCount, refreshUnread, setUnreadCount }}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error("useNotifications must be used within NotificationsProvider");
  return ctx;
}
