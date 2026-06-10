import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { AppState } from "react-native";
import { useAuth } from "@/contexts/AuthContext";
import {
  fetchMyNotices,
  dismissNotice as dismissNoticeApi,
  type MemberNotice,
} from "@/lib/community";

// App-wide moderation notices for the signed-in member (warnings an admin sent
// and/or a block notice). Lifting this above the community feed lets the rest of
// the app react to a notice the moment it lands: the tab bar shows a badge no
// matter which screen the member is on, not only when they reopen the feed.
type NoticesContextType = {
  notices: MemberNotice[];
  // True while the member has at least one un-acknowledged notice (warning or
  // block). Drives the community tab badge.
  hasUnread: boolean;
  // Re-fetch the member's notices from the server.
  refresh: () => Promise<void>;
  // Dismiss (acknowledge) a warning notice. Optimistic: removed locally first,
  // restored if the server rejects it.
  dismiss: (id: string) => Promise<void>;
};

const NoticesContext = createContext<NoticesContextType | undefined>(undefined);

// How often to poll for newly-sent notices while the app is open. A warning is
// not time-critical, so a slow poll keeps it fresh without hammering the server;
// returning to the foreground also triggers an immediate refresh.
const POLL_MS = 60_000;

export function NoticesProvider({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  const [notices, setNotices] = useState<MemberNotice[]>([]);

  const refresh = useCallback(async () => {
    if (!token) {
      setNotices([]);
      return;
    }
    try {
      const list = await fetchMyNotices({ token });
      setNotices(list);
    } catch {
      // A failed fetch should never surface as an error here; keep whatever we
      // last had so a transient blip doesn't clear a real notice.
    }
  }, [token]);

  // Initial load (and reset to empty on sign-out).
  useEffect(() => {
    if (!token) {
      setNotices([]);
      return;
    }
    refresh();
  }, [token, refresh]);

  // Slow background poll so a notice sent mid-session appears without the member
  // navigating anywhere.
  useEffect(() => {
    if (!token) return;
    const id = setInterval(() => {
      refresh();
    }, POLL_MS);
    return () => clearInterval(id);
  }, [token, refresh]);

  // Refresh the instant the app returns to the foreground (a notice may have
  // been sent while it was backgrounded).
  useEffect(() => {
    if (!token) return;
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") refresh();
    });
    return () => sub.remove();
  }, [token, refresh]);

  const dismiss = useCallback(
    async (id: string) => {
      if (!token) return;
      const snapshot = notices;
      // Optimistically remove it so the badge and banner clear immediately.
      setNotices((prev) => prev.filter((n) => n.id !== id));
      try {
        await dismissNoticeApi({ token, id });
      } catch (e) {
        setNotices(snapshot);
        throw e;
      }
    },
    [token, notices]
  );

  return (
    <NoticesContext.Provider
      value={{ notices, hasUnread: notices.length > 0, refresh, dismiss }}
    >
      {children}
    </NoticesContext.Provider>
  );
}

export function useNotices() {
  const ctx = useContext(NoticesContext);
  if (!ctx) throw new Error("useNotices must be used within NoticesProvider");
  return ctx;
}
