// Canonical subscription shape + plan catalog shared by the client
// (contexts/SubscriptionContext, the Plan tab, the onboarding paywall) and the
// server (lib/userStore, app/api/subscription). Kept free of any react-native
// imports so it is safe to import from both the app and the Metro-Node API
// routes. The server is the source of truth; the device only keeps an offline
// cache.
//
// PROVIDER NOTE: the billing provider here is a self-contained PLACEHOLDER. It
// records subscription state changes locally (in Postgres) and computes renewal
// dates itself, so the whole "manage your plan" flow works end-to-end without a
// real payment gateway. To go live with Stripe / RevenueCat, replace the bodies
// of the transition functions below (subscribe/switchPlan/cancel/resume) with
// calls into the provider's SDK and let provider webhooks update the stored
// record — the Subscription shape and the rest of the app stay the same.

export type PlanKey = "weekly" | "monthly" | "yearly";

export type SubscriptionStatus = "none" | "trialing" | "active" | "canceled";

export type Subscription = {
  status: SubscriptionStatus;
  planKey: PlanKey;
  // Which billing provider owns this record. "placeholder" until a real gateway
  // is wired in.
  provider: string;
  // Epoch ms. 0 when the member has never had a subscription.
  startedAt: number;
  // Epoch ms the current paid (or trial) period ends — the renewal date.
  currentPeriodEnd: number;
  // When true the plan will not renew at currentPeriodEnd; access continues
  // until then. Set by "cancel", cleared by "resume".
  cancelAtPeriodEnd: boolean;
  // Epoch ms the free trial ends, or null when there is/was no trial.
  trialEndsAt: number | null;
  // Opaque ids from the real provider once one is wired in.
  providerCustomerId: string | null;
  providerSubscriptionId: string | null;
  updatedAt: number;
};

export const TRIAL_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

export type PlanInfo = {
  key: PlanKey;
  name: string;
  // Short price, e.g. "₦19,999".
  amountLabel: string;
  // Period suffix, e.g. "/ year".
  periodLabel: string;
  // Full marketing line, e.g. "₦19,999 / year · Save 67%".
  fullLabel: string;
  periodDays: number;
  best?: boolean;
};

export const PLAN_ORDER: PlanKey[] = ["weekly", "monthly", "yearly"];

export const PLANS: Record<PlanKey, PlanInfo> = {
  weekly: {
    key: "weekly",
    name: "Weekly",
    amountLabel: "₦1,999",
    periodLabel: "/ week",
    fullLabel: "₦1,999 / week",
    periodDays: 7,
  },
  monthly: {
    key: "monthly",
    name: "Monthly",
    amountLabel: "₦4,999",
    periodLabel: "/ month",
    fullLabel: "₦4,999 / month",
    periodDays: 30,
  },
  yearly: {
    key: "yearly",
    name: "Yearly",
    amountLabel: "₦19,999",
    periodLabel: "/ year",
    fullLabel: "₦19,999 / year · Save 67%",
    periodDays: 365,
    best: true,
  },
};

export function isPlanKey(v: unknown): v is PlanKey {
  return v === "weekly" || v === "monthly" || v === "yearly";
}

// The plan a brand-new account defaults to in the catalog UI before they pick.
export const DEFAULT_PLAN_KEY: PlanKey = "yearly";

export const DEFAULT_SUBSCRIPTION: Subscription = {
  status: "none",
  planKey: DEFAULT_PLAN_KEY,
  provider: "placeholder",
  startedAt: 0,
  currentPeriodEnd: 0,
  cancelAtPeriodEnd: false,
  trialEndsAt: null,
  providerCustomerId: null,
  providerSubscriptionId: null,
  updatedAt: 0,
};

// True when the member currently has access (active or in-trial and the period
// hasn't lapsed). A canceled-but-not-yet-expired plan is still active.
export function isSubscriptionActive(sub: Subscription, now: number = Date.now()): boolean {
  if (sub.status !== "active" && sub.status !== "trialing") return false;
  return sub.currentPeriodEnd > now;
}

// Whole days remaining in the current period (never negative).
export function daysLeft(sub: Subscription, now: number = Date.now()): number {
  if (!sub.currentPeriodEnd) return 0;
  return Math.max(0, Math.ceil((sub.currentPeriodEnd - now) / DAY_MS));
}

// ---------------------------------------------------------------------------
// Placeholder provider transitions. Pure functions: given the existing record
// they return the next record. The client applies them optimistically for an
// instant UI; the server applies the same ones as the authoritative write.
// ---------------------------------------------------------------------------

// Starts (or restarts) a subscription on the given plan, optionally with a free
// trial. Used by the onboarding paywall and by re-subscribing after a lapse.
export function subscribeTo(
  prev: Subscription,
  planKey: PlanKey,
  opts: { trial?: boolean } = {},
  now: number = Date.now()
): Subscription {
  const plan = PLANS[planKey] ?? PLANS[DEFAULT_PLAN_KEY];
  const trial = !!opts.trial;
  const periodEnd = now + (trial ? TRIAL_DAYS : plan.periodDays) * DAY_MS;
  return {
    ...prev,
    status: trial ? "trialing" : "active",
    planKey: plan.key,
    startedAt: now,
    currentPeriodEnd: periodEnd,
    cancelAtPeriodEnd: false,
    trialEndsAt: trial ? now + TRIAL_DAYS * DAY_MS : null,
    updatedAt: now,
  };
}

// Switches an active subscription to a different plan. The placeholder resets
// the period to a full term from now (a real provider would prorate).
export function switchPlan(
  prev: Subscription,
  planKey: PlanKey,
  now: number = Date.now()
): Subscription {
  const plan = PLANS[planKey] ?? PLANS[DEFAULT_PLAN_KEY];
  // Switching off a lapsed/none subscription is treated as a fresh subscribe.
  if (!isSubscriptionActive(prev, now)) {
    return subscribeTo(prev, planKey, { trial: false }, now);
  }
  return {
    ...prev,
    status: "active",
    planKey: plan.key,
    startedAt: now,
    currentPeriodEnd: now + plan.periodDays * DAY_MS,
    cancelAtPeriodEnd: false,
    trialEndsAt: null,
    updatedAt: now,
  };
}

// Flags the plan to stop renewing; access continues until currentPeriodEnd.
export function cancelSubscription(prev: Subscription, now: number = Date.now()): Subscription {
  return { ...prev, cancelAtPeriodEnd: true, updatedAt: now };
}

// Undoes a pending cancellation so the plan renews again.
export function resumeSubscription(prev: Subscription, now: number = Date.now()): Subscription {
  return { ...prev, cancelAtPeriodEnd: false, updatedAt: now };
}

// The state a brand-new (or never-subscribed) account is seeded with so the
// Plan tab shows a real, manageable subscription rather than nothing. Mirrors
// the app's prior always-Premium placeholder, but now it is a real persisted
// record the member can switch or cancel.
export function seededActiveSubscription(now: number = Date.now()): Subscription {
  return subscribeTo(DEFAULT_SUBSCRIPTION, DEFAULT_PLAN_KEY, { trial: false }, now);
}

function asNumber(v: unknown, fallback: number): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

// Coerces a stored (possibly partial, legacy, or hand-edited) blob into a full,
// sane Subscription so bad data can't surface broken values in the UI.
export function sanitizeSubscription(input: unknown): Subscription {
  const src = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const status: SubscriptionStatus =
    src.status === "trialing" || src.status === "active" || src.status === "canceled"
      ? src.status
      : "none";
  const planKey = isPlanKey(src.planKey) ? src.planKey : DEFAULT_PLAN_KEY;
  return {
    status,
    planKey,
    provider: typeof src.provider === "string" && src.provider ? src.provider : "placeholder",
    startedAt: Math.max(0, asNumber(src.startedAt, 0)),
    currentPeriodEnd: Math.max(0, asNumber(src.currentPeriodEnd, 0)),
    cancelAtPeriodEnd: !!src.cancelAtPeriodEnd,
    trialEndsAt: src.trialEndsAt == null ? null : Math.max(0, asNumber(src.trialEndsAt, 0)),
    providerCustomerId: typeof src.providerCustomerId === "string" ? src.providerCustomerId : null,
    providerSubscriptionId:
      typeof src.providerSubscriptionId === "string" ? src.providerSubscriptionId : null,
    updatedAt: Math.max(0, asNumber(src.updatedAt, 0)),
  };
}

// Formats a renewal date like "Jun 1" for the compact Plan-tab stat tile.
export function formatRenewalShort(ms: number): string {
  if (!ms) return "—";
  try {
    return new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return "—";
  }
}

// Formats a renewal date like "Jun 1, 2026" for the billing sheet.
export function formatRenewalLong(ms: number): string {
  if (!ms) return "—";
  try {
    return new Date(ms).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}
