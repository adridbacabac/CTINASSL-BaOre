import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  createAccountRequest,
  deleteAccountRequest,
  listAccountsRequest,
  normalizeAccount,
  resetAccountPasswordRequest,
  updateAccountRequest,
} from "./api.js";
import {
  accountFormFor,
  createPayload,
  deleteBlockReason,
  isLastAdmin,
  movementBelongsTo,
  movementStaff,
  removeAccountFrom,
  roleLockReason,
  updatePayload,
  upsertAccount,
  validateAccountForm,
} from "./accounts.js";

function jsonResponse(status, payload) {
  return { ok: status >= 200 && status < 300, status, json: async () => payload };
}

function recorder(status, payload) {
  const calls = [];
  return {
    calls,
    dependencies: {
      env: {},
      fetchImpl: async (url, options) => {
        calls.push({ url, options });
        return jsonResponse(status, payload);
      },
    },
  };
}

const admin = { id: "a1", name: "Admin One", username: "admin", email: "admin@baore.com", role: "admin", createdAt: "2026-01-01T00:00:00.000Z" };
const employee = { id: "u1", name: "User One", username: "employee", email: "user@baore.com", role: "user", createdAt: "2026-01-02T00:00:00.000Z" };

describe("account API client", () => {
  test("lists accounts with credentials and drops unknown fields", async () => {
    const { calls, dependencies } = recorder(200, { users: [{ ...admin, passwordHash: "x" }, employee] });
    const result = await listAccountsRequest(dependencies);
    assert.equal(result.ok, true);
    assert.deepEqual(result.accounts, [admin, employee]);
    assert.equal(calls[0].url, "http://127.0.0.1:5000/api/users");
    assert.equal(calls[0].options.method, "GET");
    assert.equal(calls[0].options.credentials, "include");
    assert.equal(JSON.stringify(result).includes("passwordHash"), false);
  });

  test("rejects malformed list payloads and unknown roles", async () => {
    const bad = await listAccountsRequest(recorder(200, { users: [{ ...admin, role: "employee" }] }).dependencies);
    assert.equal(bad.ok, false);
    assert.match(bad.error, /unexpected response/);
    const missing = await listAccountsRequest(recorder(200, {}).dependencies);
    assert.equal(missing.ok, false);
    assert.equal(normalizeAccount({ ...admin, createdAt: 5 }).createdAt, null);
  });

  test("sends create, update, reset, and delete to the account endpoints", async () => {
    const create = recorder(201, { user: employee });
    const created = await createAccountRequest({ name: "User One", username: "employee", email: "user@baore.com", password: "secret-pass", role: "user" }, create.dependencies);
    assert.equal(created.ok, true);
    assert.deepEqual(created.account, employee);
    assert.equal(create.calls[0].options.method, "POST");
    assert.equal(create.calls[0].url.endsWith("/api/users"), true);

    const update = recorder(200, { user: { ...employee, role: "admin" } });
    const updated = await updateAccountRequest("u1", { role: "admin" }, update.dependencies);
    assert.equal(updated.account.role, "admin");
    assert.equal(update.calls[0].options.method, "PATCH");
    assert.equal(update.calls[0].url.endsWith("/api/users/u1"), true);
    assert.deepEqual(JSON.parse(update.calls[0].options.body), { role: "admin" });

    const reset = recorder(200, { user: employee, message: "Password updated." });
    const resetResult = await resetAccountPasswordRequest("u1", "new-secret-pass", reset.dependencies);
    assert.equal(resetResult.ok, true);
    assert.equal(reset.calls[0].url.endsWith("/api/users/u1/password"), true);
    assert.equal(JSON.stringify(resetResult).includes("new-secret-pass"), false);

    const remove = recorder(200, { message: "Account deleted." });
    const removed = await deleteAccountRequest("u/1", remove.dependencies);
    assert.equal(removed.ok, true);
    assert.equal(remove.calls[0].options.method, "DELETE");
    assert.equal(remove.calls[0].url.endsWith("/api/users/u%2F1"), true);
  });

  test("surfaces backend rejection messages and statuses", async () => {
    const duplicate = await createAccountRequest({}, recorder(409, { error: "That username is already in use." }).dependencies);
    assert.deepEqual(duplicate, { ok: false, status: 409, error: "That username is already in use." });
    const lastAdmin = await deleteAccountRequest("a1", recorder(409, { error: "Keep at least one administrator account." }).dependencies);
    assert.equal(lastAdmin.error, "Keep at least one administrator account.");
    const denied = await listAccountsRequest(recorder(403, { error: "You do not have access to this action." }).dependencies);
    assert.equal(denied.status, 403);
    const signedOut = await updateAccountRequest("u1", { name: "X" }, recorder(401, { error: "Authentication required." }).dependencies);
    assert.equal(signedOut.status, 401);
    const offline = await listAccountsRequest({ env: {}, fetchImpl: async () => { throw new Error("offline"); } });
    assert.equal(offline.status, 0);
    assert.match(offline.error, /could not be reached/);
  });
});

describe("account management logic", () => {
  test("validates forms like the backend", () => {
    const form = { name: "New Staff", username: "new.staff", email: "new@baore.com", password: "long-enough", role: "user" };
    assert.equal(validateAccountForm(form, "create"), "");
    assert.equal(validateAccountForm({ ...form, name: "  " }, "create"), "Name is required.");
    assert.equal(validateAccountForm({ ...form, email: "nope" }, "create"), "Enter a valid email address.");
    assert.match(validateAccountForm({ ...form, username: "a b" }, "create"), /Username must be/);
    assert.equal(validateAccountForm({ ...form, password: "short" }, "create"), "Password must be at least 8 characters.");
    assert.equal(validateAccountForm({ ...form, password: "é".repeat(40) }, "create"), "Password must be 72 bytes or fewer.");
    assert.equal(validateAccountForm({ ...form, password: "" }, "edit"), "");
    assert.equal(validateAccountForm({ ...form, password: "short" }, "password"), "Password must be at least 8 characters.");
  });

  test("builds create payloads and sends only changed fields on update", () => {
    assert.deepEqual(createPayload({ name: " A ", username: " B ", email: " c@d.e ", password: " p ", role: "owner" }), {
      name: "A", username: "B", email: "c@d.e", password: " p ", role: "user",
    });
    const form = accountFormFor(employee);
    assert.equal(form.password, "");
    assert.equal(updatePayload(form, employee), null);
    assert.equal(updatePayload({ ...form, username: " EMPLOYEE " }, employee), null);
    assert.deepEqual(updatePayload({ ...form, name: "Renamed", role: "admin" }, employee), { name: "Renamed", role: "admin" });
  });

  test("protects self and the last admin", () => {
    const accounts = [admin, employee];
    assert.equal(isLastAdmin(admin, accounts), true);
    assert.equal(isLastAdmin(employee, accounts), false);
    assert.equal(deleteBlockReason(admin, accounts, admin), "You cannot delete your own account.");
    assert.equal(deleteBlockReason(admin, accounts, { ...employee, role: "admin" }), "Keep at least one administrator account.");
    assert.equal(deleteBlockReason(employee, accounts, admin), "");
    assert.equal(roleLockReason(admin, accounts, admin), "You cannot remove your own administrator access.");
    assert.equal(roleLockReason(employee, accounts, admin), "");
    const twoAdmins = [admin, { ...employee, role: "admin" }];
    assert.equal(deleteBlockReason(twoAdmins[1], twoAdmins, admin), "");
  });

  test("updates the local list from server responses", () => {
    const renamed = { ...employee, name: "Renamed" };
    assert.deepEqual(upsertAccount([admin, employee], renamed), [admin, renamed]);
    assert.deepEqual(upsertAccount([admin], employee), [admin, employee]);
    assert.deepEqual(removeAccountFrom([admin, employee], "u1"), [admin]);
  });

  test("attributes movements by account id, with legacy starter ids for display only", () => {
    const current = { id: "a1", name: "Admin One", username: "admin", email: "admin@baore.com", role: "admin" };
    assert.equal(movementBelongsTo({ userId: "a1" }, current), true);
    assert.equal(movementBelongsTo({ userId: "admin-1" }, current), true);
    assert.equal(movementBelongsTo({ userId: "user-1" }, current), false);
    assert.equal(movementBelongsTo({ userId: "a1" }, null), false);
    assert.equal(movementStaff({ userId: "user-1" }, [admin, employee], current).name, "User One");
    assert.equal(movementStaff({ userId: "user-123" }, [admin, employee], current), null);
  });
});
