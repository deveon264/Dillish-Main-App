import { Platform } from "react-native";

export function getApiUrl(): string {
  if (Platform.OS === "web") {
    if (typeof window !== "undefined" && window.location) {
      return window.location.origin;
    }
    return "";
  }
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  if (domain) {
    return domain.startsWith("http") ? domain : `https://${domain}`;
  }
  return "";
}
