import assert from "node:assert/strict";
import { afterEach, describe, test } from "node:test";
import {
  apiBaseUrl,
  clearSessionCache,
  interpretSession,
  loginRequest,
  logoutRequest,
  normalizeUser,
  rememberSession,
  requestJson,
  restoreSession,
  retrySession,
} from "./api.js";
import { landingPath, protectPath } from "./access.js";

function jsonResponse(status, payload, { cookie } = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => cookie ?? null },
    json: async () => payload,
  };
}

describe("frontend auth client", () => {
  afterEach(() => {
    clearSessionCache();
  });

  test("uses the configured API origin and always sends credentials", async () => {
    assert.equal(apiBaseUrl({}), "http://127.0.0.1:5000");
    assert.equal(apiBaseUrl({ VITE_API_BASE_URL: "http://localhost:5000/" }), "http://localhost:5000");
    let seen;
    await requestJson("/api/auth/me", {}, {
      env: { VITE_API_BASE_URL: "http://127.0.0.1:5000" },
      fetchImpl: async (url, options) => {
        seen = { url, options };
        return jsonResponse(401, { error: "Authentication required." });
      },
    });
    assert.equal(seen.url, "http://127.0.0.1:5000/api/auth/me");
    assert.equal(seen.options.credentials, "include");
    assert.equal(seen.options.body, undefined);
  });

  test("normalizes the backend profile and treats 401 as signed out", () => {
    assert.deepEqual(normalizeUser({
      id: "abc",
      name: "Admin One",
      username: "admin",
      email: "admin@baore.com",
      role: "admin",
      passwordHash: "secret",
    }), {
      id: "abc",
      name: "Admin One",
      username: "admin",
      email: "admin@baore.com",
      role: "admin",
    });
    assert.equal(normalizeUser({ id: "abc", role: "employee" }), null);
    assert.deepEqual(interpretSession({ ok: false, status: 401, error: "Authentication required." }), {
      status: "unauthenticated",
      user: null,
      message: "",
    });
    assert.equal(interpretSession({ ok: false, status: 0, error: "offline" }).status, "error");
  });

  test("login reports invalid credentials without storing a token", async () => {
    const calls = [];
    const denied = await loginRequest("admin", "wrong-password", {
      env: {},
      fetchImpl: async (url, options) => {
        calls.push({ url, options });
        return jsonResponse(401, { error: "Invalid username or password." });
      },
    });
    assert.equal(denied.ok, false);
    assert.equal(denied.error, "Those sign-in details don’t match a store account.");
    assert.equal(calls[0].options.credentials, "include");
    assert.equal(calls[0].options.body.includes("wrong-password"), true);
    assert.equal(JSON.stringify(denied).includes("passwordHash"), false);

    const accepted = await loginRequest("employee", "secret", {
      env: {},
      fetchImpl: async () => jsonResponse(200, {
        user: { id: "emp", name: "User One", username: "employee", email: "user@baore.com", role: "user" },
      }),
    });
    assert.equal(accepted.ok, true);
    assert.equal(accepted.user.role, "user");
  });

  test("logout failure stays unsuccessful and session restore is shared", async () => {
    const failed = await logoutRequest({
      env: {},
      fetchImpl: async () => { throw new Error("connect ECONNREFUSED"); },
    });
    assert.equal(failed.ok, false);
    assert.match(failed.error, /could not be reached/i);

    let calls = 0;
    const dependencies = {
      env: {},
      fetchImpl: async () => {
        calls += 1;
        return jsonResponse(200, {
          user: { id: "adm", name: "Admin One", username: "admin", email: "admin@baore.com", role: "admin" },
        });
      },
    };
    const first = await restoreSession(dependencies);
    const second = await restoreSession(dependencies);
    assert.equal(first, second);
    assert.equal(calls, 1);
    assert.equal(first.status, "authenticated");
    rememberSession("unauthenticated", null);
    const remembered = await restoreSession(dependencies);
    assert.equal(remembered.status, "unauthenticated");
    assert.equal(calls, 1);
    const retried = await retrySession(dependencies);
    assert.equal(retried.status, "authenticated");
    assert.equal(calls, 2);
  });

  test("route protection waits, then follows the backend role", () => {
    assert.equal(protectPath("loading", null, "/dashboard"), "wait");
    assert.equal(protectPath("error", null, "/dashboard"), "wait");
    assert.equal(protectPath("unauthenticated", null, "/inventory"), "redirect-login");
    assert.equal(protectPath("unauthenticated", null, "/login"), "show-login");
    assert.equal(protectPath("authenticated", "admin", "/login"), "redirect-dashboard");
    assert.equal(protectPath("authenticated", "user", "/activity"), "redirect-dashboard");
    assert.equal(protectPath("authenticated", "user", "/team"), "redirect-dashboard");
    assert.equal(protectPath("authenticated", "user", "/inventory"), "allow");
    assert.equal(protectPath("authenticated", "admin", "/team"), "allow");
    assert.equal(protectPath("authenticated", "admin", "/unknown"), "redirect-dashboard");
    assert.equal(landingPath("authenticated"), "/dashboard");
    assert.equal(landingPath("unauthenticated"), "/login");
  });
});
