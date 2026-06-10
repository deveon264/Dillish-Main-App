import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

// adminAuth reads SESSION_SECRET lazily, so setting it before any handler runs
// is enough. A throwaway value for the test runtime.
process.env.SESSION_SECRET = "test-session-secret-please-ignore";

import { ADMIN_EMAIL } from "@/constants/admin";
import { mintSessionToken } from "@/lib/adminAuth";

import {
  savePushToken,
  listPushTokensForUser,
  removePushToken,
  deletePushTokens,
} from "@/lib/pushStore";
import { sendModerationPush } from "@/lib/push";
import { POST as warnPost } from "@/app/api/community-author-warn+api";
import { POST as registerPost, DELETE as registerDelete } from "@/app/api/push-register+api";

import { installFakeDb, uninstallFakeDb, type FakeDb } from "./support/fakeUserDb";

let db: FakeDb;
const realFetch = globalThis.fetch;

beforeEach(() => {
  db = installFakeDb();
});

afterEach(() => {
  uninstallFakeDb();
  globalThis.fetch = realFetch;
});

const ADMIN_ID = "admin-1";
const MEMBER_A = "member-a";
const MEMBER_B = "member-b";

function seedActors() {
  db.seedUser({ id: ADMIN_ID, email: ADMIN_EMAIL, name: "Admin", is_admin: true });
  db.seedUser({ id: MEMBER_A, email: "a@example.com", name: "Aja" });
  db.seedUser({ id: MEMBER_B, email: "b@example.com", name: "Bex" });
}

async function adminToken(): Promise<string> {
  const { token } = await mintSessionToken({ sub: ADMIN_ID, email: ADMIN_EMAIL, isAdmin: true });
  return token;
}

async function memberToken(sub: string, email: string): Promise<string> {
  const { token } = await mintSessionToken({ sub, email, isAdmin: false });
  return token;
}

// Replaces global fetch with a stub that records every Expo push request and
// returns the given tickets array (matching Expo's { data: [...] } shape).
function stubExpoFetch(ticketsFor: (messages: any[]) => any[]) {
  const calls: { url: string; messages: any[] }[] = [];
  globalThis.fetch = (async (url: any, init: any) => {
    const messages = JSON.parse(init?.body ?? "[]");
    calls.push({ url: String(url), messages });
    return {
      ok: true,
      json: async () => ({ data: ticketsFor(messages) }),
    } as any;
  }) as any;
  return calls;
}

test("savePushToken stores a token and lists it for the owner", async () => {
  await savePushToken({ userId: MEMBER_A, token: "ExpoTok[a1]", platform: "ios" });
  const tokens = await listPushTokensForUser(MEMBER_A);
  assert.deepEqual(tokens, ["ExpoTok[a1]"]);
  assert.deepEqual(await listPushTokensForUser(MEMBER_B), []);
});

test("re-registering a token re-points it to the new member (shared device)", async () => {
  await savePushToken({ userId: MEMBER_A, token: "ExpoTok[shared]", platform: "ios" });
  await savePushToken({ userId: MEMBER_B, token: "ExpoTok[shared]", platform: "ios" });
  assert.deepEqual(await listPushTokensForUser(MEMBER_A), []);
  assert.deepEqual(await listPushTokensForUser(MEMBER_B), ["ExpoTok[shared]"]);
});

test("removePushToken only drops the caller's own token", async () => {
  await savePushToken({ userId: MEMBER_A, token: "ExpoTok[a1]", platform: "ios" });
  // Wrong owner: nothing removed.
  assert.equal(await removePushToken({ userId: MEMBER_B, token: "ExpoTok[a1]" }), false);
  assert.deepEqual(await listPushTokensForUser(MEMBER_A), ["ExpoTok[a1]"]);
  // Right owner: removed.
  assert.equal(await removePushToken({ userId: MEMBER_A, token: "ExpoTok[a1]" }), true);
  assert.deepEqual(await listPushTokensForUser(MEMBER_A), []);
});

test("sendModerationPush fans out to all of a member's devices", async () => {
  await savePushToken({ userId: MEMBER_A, token: "ExpoTok[a1]", platform: "ios" });
  await savePushToken({ userId: MEMBER_A, token: "ExpoTok[a2]", platform: "android" });
  const calls = stubExpoFetch((messages) => messages.map(() => ({ status: "ok" })));

  await sendModerationPush({ userId: MEMBER_A, kind: "warning", message: "Please keep it kind." });

  assert.equal(calls.length, 1);
  const sent = calls[0].messages;
  assert.equal(sent.length, 2);
  assert.deepEqual(
    sent.map((m: any) => m.to).sort(),
    ["ExpoTok[a1]", "ExpoTok[a2]"]
  );
  assert.equal(sent[0].body, "Please keep it kind.");
  assert.equal(sent[0].data.type, "moderation");
  assert.equal(sent[0].data.kind, "warning");
});

test("sendModerationPush uses a generic body for a block", async () => {
  await savePushToken({ userId: MEMBER_A, token: "ExpoTok[a1]", platform: "ios" });
  const calls = stubExpoFetch((messages) => messages.map(() => ({ status: "ok" })));

  await sendModerationPush({ userId: MEMBER_A, kind: "block" });

  const msg = calls[0].messages[0];
  assert.equal(msg.data.kind, "block");
  assert.match(msg.body, /restricted your community access/i);
  assert.doesNotMatch(msg.body, /\u2014/); // no em dash
});

test("sendModerationPush prunes tokens Expo reports as unregistered", async () => {
  await savePushToken({ userId: MEMBER_A, token: "ExpoTok[live]", platform: "ios" });
  await savePushToken({ userId: MEMBER_A, token: "ExpoTok[dead]", platform: "android" });
  // Mark the second device as no longer registered.
  stubExpoFetch((messages) =>
    messages.map((m: any) =>
      m.to === "ExpoTok[dead]"
        ? { status: "error", details: { error: "DeviceNotRegistered" } }
        : { status: "ok" }
    )
  );

  await sendModerationPush({ userId: MEMBER_A, kind: "warning", message: "hi" });

  assert.deepEqual(await listPushTokensForUser(MEMBER_A), ["ExpoTok[live]"]);
});

test("sendModerationPush is a no-op when the member has no devices", async () => {
  let called = false;
  globalThis.fetch = (async () => {
    called = true;
    return { ok: true, json: async () => ({ data: [] }) } as any;
  }) as any;

  await sendModerationPush({ userId: MEMBER_A, kind: "warning", message: "hi" });
  assert.equal(called, false);
});

test("deletePushTokens with an empty list does nothing", async () => {
  await savePushToken({ userId: MEMBER_A, token: "ExpoTok[a1]", platform: "ios" });
  assert.equal(await deletePushTokens([]), 0);
  assert.deepEqual(await listPushTokensForUser(MEMBER_A), ["ExpoTok[a1]"]);
});

test("push-register endpoint stores a token for the signed-in member", async () => {
  seedActors();
  const token = await memberToken(MEMBER_A, "a@example.com");
  const resp = await registerPost(
    new Request("http://t/api/push-register", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ token: "ExpoTok[dev]", platform: "ios" }),
    })
  );
  assert.equal(resp.status, 200);
  assert.deepEqual(await listPushTokensForUser(MEMBER_A), ["ExpoTok[dev]"]);
});

test("push-register requires a token and a session", async () => {
  seedActors();
  // No auth.
  const noAuth = await registerPost(
    new Request("http://t/api/push-register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: "ExpoTok[dev]" }),
    })
  );
  assert.equal(noAuth.status, 401);

  // Missing token.
  const token = await memberToken(MEMBER_A, "a@example.com");
  const noToken = await registerPost(
    new Request("http://t/api/push-register", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({}),
    })
  );
  assert.equal(noToken.status, 400);
});

test("push-register DELETE drops the device token", async () => {
  seedActors();
  await savePushToken({ userId: MEMBER_A, token: "ExpoTok[dev]", platform: "ios" });
  const token = await memberToken(MEMBER_A, "a@example.com");
  const resp = await registerDelete(
    new Request("http://t/api/push-register?token=ExpoTok%5Bdev%5D", {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    })
  );
  assert.equal(resp.status, 200);
  assert.deepEqual(await listPushTokensForUser(MEMBER_A), []);
});

test("warning a member fires a push to their devices", async () => {
  seedActors();
  await savePushToken({ userId: MEMBER_A, token: "ExpoTok[a1]", platform: "ios" });
  const calls = stubExpoFetch((messages) => messages.map(() => ({ status: "ok" })));

  const token = await adminToken();
  const resp = await warnPost(
    new Request("http://t/api/community-author-warn", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ authorId: MEMBER_A, message: "Please keep it kind." }),
    })
  );
  assert.equal(resp.status, 200);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].messages[0].to, "ExpoTok[a1]");
  assert.equal(calls[0].messages[0].body, "Please keep it kind.");
});
