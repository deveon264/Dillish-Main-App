import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";
import { getJSON, setJSON } from "@/lib/storage";
import { getApiUrl } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import {
  type Subscription,
  type PlanKey,
  DEFAULT_SUBSCRIPTION,
  sanitizeSubscription,
  subscribeTo,
  switchPlan as switchPlanLocal,
  cancelSubscription as cancelLocal,
  resumeSubscription as resumeLocal,
} from "@/lib/subscription";

export type { Subscription } from "@/lib/subscription";

type ActionResult = { ok: boolean; error?: string };

type SubscriptionContextType = {
  ready: boolean;
  subscription: Subscription;
  // Start (or restart) a subscription on a plan, optionally with a free trial.
  subscribe: (planKey: PlanKey, opts?: { trial?: boolean }) => Promise<ActionResult>;
  // Move an active subscription to a different plan.
  switchPlan: (planKey: PlanKey) => Promise<ActionResult>;
  // Stop renewing (access continues until the period ends).
  cancel: () => Promise<ActionResult>;
  // Undo a pending cancellation.
  resume: () => Promise<ActionResult>;
};

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

const keyFor = (uid: string) => `florish:u:${uid}:subscription`;

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const { user, token } = useAuth();
  const uid = user?.id ?? null;

  const [ready, setReady] = useState(false);
  const [subscription, setSubscription] = useState<Subscription>(DEFAULT_SUBSCRIPTION);

  // Load the subscription: the server is the source of truth (so the plan
  // follows the member across devices), with the on-device cache as an offline
  // fallback. Mirrors the DataContext profile-sync pattern.
  useEffect(() => {
    let active = true;
    (async () => {
      if (!uid) {
        setSubscription(DEFAULT_SUBSCRIPTION);
        setReady(false);
        return;
      }
      setReady(false);
      const cached = await getJSON<Subscription>(keyFor(uid), DEFAULT_SUBSCRIPTION);
      let merged = sanitizeSubscription(cached);

      if (token) {
        try {
          const resp = await fetch(`${getApiUrl()}/api/subscription`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (resp.ok) {
            const { subscription: server } = (await resp.json()) as {
              subscription: Subscription | null;
            };
            if (!active) return;
            if (server) {
              merged = sanitizeSubscription(server);
              setJSON(keyFor(uid), merged);
            }
          }
        } catch {
          // offline / transient: keep the local cache.
        }
      }

      if (!active) return;
      setSubscription(merged);
      setReady(true);
    })();
    return () => {
      active = false;
    };
  }, [uid, token]);

  // Sends an action to the server, optimistically applying `optimistic` first so
  // the UI updates instantly, and reconciling with the authoritative result.
  const runAction = useCallback(
    async (
      body: Record<string, unknown>,
      optimistic: (prev: Subscription) => Subscription
    ): Promise<ActionResult> => {
      if (!uid) return { ok: false, error: "Please sign in again." };

      const prev = subscription;
      const next = optimistic(prev);
      setSubscription(next);
      setJSON(keyFor(uid), next);

      if (!token) return { ok: true };
      try {
        const resp = await fetch(`${getApiUrl()}/api/subscription`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify(body),
        });
        let data: any = null;
        try {
          data = await resp.json();
        } catch {
          // ignore
        }
        if (resp.ok && data?.subscription) {
          const saved = sanitizeSubscription(data.subscription);
          setSubscription(saved);
          setJSON(keyFor(uid), saved);
          return { ok: true };
        }
        // Server rejected it — roll back the optimistic change.
        setSubscription(prev);
        setJSON(keyFor(uid), prev);
        return { ok: false, error: data?.error ?? "Could not update your plan." };
      } catch {
        // Network/transient: keep the optimistic state locally; the next load
        // reconciles with the server.
        return { ok: true };
      }
    },
    [uid, token, subscription]
  );

  const subscribe = useCallback(
    (planKey: PlanKey, opts: { trial?: boolean } = {}) =>
      runAction(
        { action: "subscribe", planKey, trial: !!opts.trial },
        (prev) => subscribeTo(prev, planKey, opts)
      ),
    [runAction]
  );

  const switchPlan = useCallback(
    (planKey: PlanKey) =>
      runAction({ action: "switch", planKey }, (prev) => switchPlanLocal(prev, planKey)),
    [runAction]
  );

  const cancel = useCallback(
    () => runAction({ action: "cancel" }, (prev) => cancelLocal(prev)),
    [runAction]
  );

  const resume = useCallback(
    () => runAction({ action: "resume" }, (prev) => resumeLocal(prev)),
    [runAction]
  );

  const value = useMemo(
    () => ({ ready, subscription, subscribe, switchPlan, cancel, resume }),
    [ready, subscription, subscribe, switchPlan, cancel, resume]
  );

  return <SubscriptionContext.Provider value={value}>{children}</SubscriptionContext.Provider>;
}

export function useSubscription() {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) throw new Error("useSubscription must be used within SubscriptionProvider");
  return ctx;
}
