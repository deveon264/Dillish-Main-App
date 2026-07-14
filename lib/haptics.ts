import { Platform, TurboModuleRegistry } from "react-native";
import { createHaptics, type PulsarPresets } from "@/lib/hapticsCore";

export { waterAddFeedback } from "@/lib/hapticsCore";

export const haptics = createHaptics({
  platform: Platform.OS,
  loadPrimary: () => {
    // Probe before requiring the package: react-native-pulsar calls
    // TurboModuleRegistry.getEnforcing at module scope, and in Expo Go (no
    // RNPulsar in the binary) that init error becomes a fatal RedBox via
    // Metro's guardedLoadModule instead of reaching hapticsCore's catch.
    if (!TurboModuleRegistry.get("RNPulsar")) {
      throw new Error("RNPulsar native module is not in this binary");
    }
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pulsar = require("react-native-pulsar") as { Presets: PulsarPresets };
    return {
      selection: () => pulsar.Presets.System.selection(),
      success: () => pulsar.Presets.System.notificationSuccess(),
      warning: () => pulsar.Presets.System.notificationWarning(),
    };
  },
  loadFallback: () => {
    // Expo Go ships this native module, so it remains available when Pulsar's
    // custom native module is not part of the running binary.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const expo = require("expo-haptics") as typeof import("expo-haptics");
    return {
      selection: () => expo.selectionAsync(),
      success: () => expo.notificationAsync(expo.NotificationFeedbackType.Success),
      warning: () => expo.notificationAsync(expo.NotificationFeedbackType.Warning),
    };
  },
});
