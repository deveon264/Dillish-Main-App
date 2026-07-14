import { Platform } from "react-native";
import Constants from "expo-constants";
import { resolveNativeApiOrigin } from "@/lib/apiOrigin";

export function getApiUrl(): string {
  if (Platform.OS === "web") {
    if (typeof window !== "undefined" && window.location) {
      return window.location.origin;
    }
    return "";
  }
  return resolveNativeApiOrigin({
    isDevelopment: typeof __DEV__ !== "undefined" && __DEV__,
    expoHostUri: Constants.expoConfig?.hostUri,
    configuredDomain: process.env.EXPO_PUBLIC_DOMAIN,
  });
}
