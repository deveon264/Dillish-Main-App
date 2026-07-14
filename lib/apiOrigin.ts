type NativeApiOriginOptions = {
  isDevelopment: boolean;
  expoHostUri?: string | null;
  configuredDomain?: string | null;
};

function withoutTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

export function apiOriginFromExpoHost(hostUri?: string | null): string {
  const raw = hostUri?.trim();
  if (!raw) return "";

  if (/^https?:\/\//i.test(raw)) {
    try {
      return new URL(raw).origin;
    } catch {
      return "";
    }
  }

  // Expo LAN manifests expose an IP/hostname and port, while Expo tunnels use
  // an exp.direct hostname. Fetch must use HTTP(S), never the exp:// deep-link
  // scheme used by the Expo Go QR code.
  const host = raw.replace(/^exp:\/\//i, "").split("/")[0];
  if (!host) return "";
  const protocol = /(^|\.)exp\.direct(?::\d+)?$/i.test(host) ? "https" : "http";
  return `${protocol}://${host}`;
}

export function configuredApiOrigin(domain?: string | null): string {
  const raw = domain?.trim();
  if (!raw) return "";
  return withoutTrailingSlash(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
}

export function resolveNativeApiOrigin({
  isDevelopment,
  expoHostUri,
  configuredDomain,
}: NativeApiOriginOptions): string {
  // API routes are served by the same Expo development server as the bundle.
  // Prefer its live manifest host so a stale .env tunnel cannot intercept LAN
  // requests. Release builds continue to use the configured public domain.
  if (isDevelopment) {
    const developmentOrigin = apiOriginFromExpoHost(expoHostUri);
    if (developmentOrigin) return developmentOrigin;
  }
  return configuredApiOrigin(configuredDomain);
}
