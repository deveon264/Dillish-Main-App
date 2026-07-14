export type SemanticHaptics = {
  selection: () => void;
  success: () => void;
  warning: () => void;
};

export type HapticKind = keyof SemanticHaptics;

export type HapticsBackend = {
  [Kind in HapticKind]: () => void | Promise<void>;
};

export type PulsarPresets = {
  System: {
    selection: () => void;
    notificationSuccess: () => void;
    notificationWarning: () => void;
  };
};

type HapticsOptions = {
  platform: string;
  loadPrimary: () => HapticsBackend;
  loadFallback: () => HapticsBackend;
};

// Both native backends stay lazy: Pulsar is absent from Expo Go, while web
// should not load either package. A failed primary is retired for the lifetime
// of this adapter so Expo Go does not repeat the same native-module exception.
export function createHaptics({ platform, loadPrimary, loadFallback }: HapticsOptions): SemanticHaptics {
  let primary: HapticsBackend | null | undefined;
  let fallback: HapticsBackend | null | undefined;

  const load = (
    current: HapticsBackend | null | undefined,
    loader: () => HapticsBackend,
    cache: (value: HapticsBackend | null) => void
  ): HapticsBackend | null => {
    if (current !== undefined) return current;
    try {
      const backend = loader();
      cache(backend);
      return backend;
    } catch {
      cache(null);
      return null;
    }
  };

  const getPrimary = () =>
    load(primary, loadPrimary, (value) => {
      primary = value;
    });

  const getFallback = () =>
    load(fallback, loadFallback, (value) => {
      fallback = value;
    });

  const containRejection = (result: void | Promise<void>, onRejected: () => void) => {
    if (result && typeof result.then === "function") {
      void Promise.resolve(result).catch(onRejected);
    }
  };

  const playFallback = (kind: HapticKind) => {
    const backend = getFallback();
    if (!backend) return;
    try {
      containRejection(backend[kind](), () => {
        fallback = null;
      });
    } catch {
      fallback = null;
    }
  };

  const play = (kind: HapticKind) => {
    if (platform === "web") return;

    const backend = getPrimary();
    if (backend) {
      try {
        containRejection(backend[kind](), () => {
          primary = null;
          playFallback(kind);
        });
        return;
      } catch {
        primary = null;
      }
    }

    playFallback(kind);
  };

  return {
    selection: () => play("selection"),
    success: () => play("success"),
    warning: () => play("warning"),
  };
}

export function waterAddFeedback(currentMl: number, amountMl: number, goalMl: number): keyof SemanticHaptics {
  return goalMl > 0 && currentMl < goalMl && currentMl + amountMl >= goalMl ? "success" : "selection";
}
