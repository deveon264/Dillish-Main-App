import { Alert, Platform } from "react-native";
import { haptics } from "@/lib/haptics";

// A promise-based confirmation that works the same on web and native: web uses
// the built-in confirm dialog, native uses a two-button Alert. Resolves true
// when the user confirms.
export function confirmAction(opts: {
  title: string;
  message?: string;
  confirmLabel?: string;
  destructive?: boolean;
}): Promise<boolean> {
  const confirmLabel = opts.confirmLabel ?? "Confirm";
  if (Platform.OS === "web") {
    const text = opts.message ? `${opts.title}\n\n${opts.message}` : opts.title;
    const confirmed = typeof window !== "undefined" ? window.confirm(text) : false;
    if (confirmed && opts.destructive) haptics.warning();
    return Promise.resolve(confirmed);
  }
  return new Promise((resolve) => {
    Alert.alert(opts.title, opts.message, [
      { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
      {
        text: confirmLabel,
        style: opts.destructive ? "destructive" : "default",
        onPress: () => {
          if (opts.destructive) haptics.warning();
          resolve(true);
        },
      },
    ]);
  });
}

// A simple acknowledgement dialog (single OK button). On web it uses alert().
export function notify(title: string, message?: string): void {
  if (Platform.OS === "web") {
    const text = message ? `${title}\n\n${message}` : title;
    if (typeof window !== "undefined") window.alert(text);
    return;
  }
  Alert.alert(title, message);
}
