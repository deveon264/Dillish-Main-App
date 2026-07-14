import { test } from "node:test";
import assert from "node:assert/strict";
import {
  apiOriginFromExpoHost,
  configuredApiOrigin,
  resolveNativeApiOrigin,
} from "@/lib/apiOrigin";

test("Expo LAN hosts resolve to the active HTTP development server", () => {
  assert.equal(apiOriginFromExpoHost("192.168.0.113:8081"), "http://192.168.0.113:8081");
  assert.equal(apiOriginFromExpoHost("localhost:8081"), "http://localhost:8081");
});

test("Expo tunnel hosts resolve to HTTPS without preserving deep-link paths", () => {
  assert.equal(
    apiOriginFromExpoHost("svqlpg0-anonymous-8081.exp.direct"),
    "https://svqlpg0-anonymous-8081.exp.direct",
  );
  assert.equal(
    apiOriginFromExpoHost("exp://fresh-anonymous-8081.exp.direct/--/entry"),
    "https://fresh-anonymous-8081.exp.direct",
  );
});

test("the live Expo host wins over a stale configured tunnel in development", () => {
  assert.equal(
    resolveNativeApiOrigin({
      isDevelopment: true,
      expoHostUri: "192.168.0.113:8081",
      configuredDomain: "https://stale-anonymous-8081.exp.direct",
    }),
    "http://192.168.0.113:8081",
  );
});

test("release builds and hostless development fall back to the configured domain", () => {
  assert.equal(
    resolveNativeApiOrigin({
      isDevelopment: false,
      expoHostUri: "192.168.0.113:8081",
      configuredDomain: "api.florish.example/",
    }),
    "https://api.florish.example",
  );
  assert.equal(
    resolveNativeApiOrigin({
      isDevelopment: true,
      expoHostUri: null,
      configuredDomain: "http://10.0.2.2:8081/",
    }),
    "http://10.0.2.2:8081",
  );
});

test("invalid or absent origins stay empty rather than producing malformed URLs", () => {
  assert.equal(apiOriginFromExpoHost(null), "");
  assert.equal(configuredApiOrigin(""), "");
});
