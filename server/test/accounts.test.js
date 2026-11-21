import assert from "node:assert/strict";
import { after, before, beforeEach, describe, test } from "node:test";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import request from "supertest";
import { createApp } from "../src/app.js";
import { AUTH_COOKIE_NAME, signAuthToken } from "../src/auth/session.js";
import { AdminGuard } from "../src/models/AdminGuard.js";
import { ADMIN_GUARD_ID } from "../src/models/constants.js";
import { User } from "../src/models/User.js";
import { runAdminMembershipChange } from "../src/services/adminMembership.js";

const testUri = "mongodb://127.0.0.1:27017/baore_cosmetics_test?replicaSet=rs0";
if (new URL(testUri).pathname.replace(/^\//, "") !== "baore_cosmetics_test") {
  throw new Error("Refusing to use a database other than baore_cosmetics_test.");
}

const env = {
  nodeEnv: "test",
  clientOrigin: "http://localhost:5173",
  jwtSecret: "test-only-jwt-secret-that-is-long-enough",
  jwtExpiresInSeconds: 3600,
  jwtMaxAgeMs: 3600 * 1000,
  loginRateLimit: { windowMs: 15 * 60 * 1000, limit: 1000 },
  bcryptCost: 4,
};

const app = createApp(env);
let admin;
let employee;

function assertDatabase() {
  if (mongoose.connection.name !== "baore_cosmetics_test") {
    throw new Error(`Refusing to use database ${mongoose.connection.name}`);
  }
}

function cookieFor(user) {
  return `${AUTH_COOKIE_NAME}=${signAuthToken(user._id, env, user.sessionVersion ?? 0)}`;
}

function cookieFromResponse(response) {
  const header = response.headers["set-cookie"]?.find((value) => value.startsWith(`${AUTH_COOKIE_NAME}=`));
  return header ? header.split(";")[0] : null;
}

function assertNoHash(response) {
  assert.equal(JSON.stringify(response.body).includes("passwordHash"), false);
  assert.equal(/\$2[aby]\$/.test(JSON.stringify(response.body)), false);
}

async function resetDatabase() {
  assertDatabase();
  await mongoose.connection.dropDatabase();
  await User.createIndexes();
  await AdminGuard.create({ _id: ADMIN_GUARD_ID, revision: 0 });
  [admin, employee] = await User.create([
    {
      name: "Admin One",
      email: "admin@baore.com",
      username: "admin",
      passwordHash: await bcrypt.hash("test-only-admin-password", 4),
      role: "admin",
    },
    {
      name: "User One",
      email: "user@baore.com",
      username: "employee",
      passwordHash: await bcrypt.hash("test-only-employee-password", 4),
      role: "user",
    },
  ]);
}

async function addAdmin(username) {
  return User.create({
    name: `Admin ${username}`,
    email: `${username}@baore.com`,
    username,
    passwordHash: await bcrypt.hash("test-only-other-password", 4),
    role: "admin",
  });
}

async function guardRevision() {
  return (await AdminGuard.findById(ADMIN_GUARD_ID).lean()).revision;
}

const newEmployee = {
  name: "  New Staff  ",
  username: "  New.Staff ",
  email: " New.Staff@Baore.com ",
  password: "test-only-new-password",
  role: "user",
};

describe("account management API", { concurrency: 1 }, () => {
  before(async () => {
    mongoose.set("autoCreate", false);
    mongoose.set("autoIndex", false);
    await mongoose.connect(testUri, { serverSelectionTimeoutMS: 8000, autoCreate: false, autoIndex: false });
    assertDatabase();
  });

  beforeEach(resetDatabase);

  after(async () => {
    assertDatabase();
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });

  test("requires authentication and the admin role on every endpoint", async () => {
    const id = String(employee._id);
    const calls = [
      (agent) => agent.get("/api/users"),
      (agent) => agent.post("/api/users").send(newEmployee),
      (agent) => agent.patch(`/api/users/${id}`).send({ name: "Changed" }),
      (agent) => agent.patch(`/api/users/${id}/password`).send({ password: "another-password" }),
      (agent) => agent.delete(`/api/users/${id}`),
    ];
    for (const call of calls) {
      const anonymous = await call(request(app));
      assert.equal(anonymous.status, 401);
      const asEmployee = await call(request(app)).set("Cookie", cookieFor(employee));
      assert.equal(asEmployee.status, 403);
      assert.deepEqual(asEmployee.body, { error: "You do not have access to this action." });
    }
    assert.equal(await User.countDocuments(), 2);
    assert.equal((await User.findById(employee._id)).name, "User One");
  });

  test("lists accounts with safe fields only", async () => {
    const response = await request(app).get("/api/users").set("Cookie", cookieFor(admin));
    assert.equal(response.status, 200);
    assert.equal(response.body.users.length, 2);
    for (const user of response.body.users) {
      assert.deepEqual(Object.keys(user).sort(), ["createdAt", "email", "id", "name", "role", "username"]);
    }
    assert.deepEqual(response.body.users.map((user) => user.username), ["admin", "employee"]);
    assertNoHash(response);
  });

  test("creates an employee and an admin with normalized fields and bcrypt hashes", async () => {
    const cookie = cookieFor(admin);
    const before = await guardRevision();
    const created = await request(app).post("/api/users").set("Cookie", cookie).send(newEmployee);
    assert.equal(created.status, 201);
    assert.equal(created.body.user.name, "New Staff");
    assert.equal(created.body.user.username, "new.staff");
    assert.equal(created.body.user.email, "new.staff@baore.com");
    assert.equal(created.body.user.role, "user");
    assertNoHash(created);

    const stored = await User.findById(created.body.user.id).select("+passwordHash");
    assert.equal(await bcrypt.compare("test-only-new-password", stored.passwordHash), true);
    assert.equal(bcrypt.getRounds(stored.passwordHash), 4);

    const createdAdmin = await request(app).post("/api/users").set("Cookie", cookie).send({
      name: "Second Admin",
      username: "second",
      email: "second@baore.com",
      password: "test-only-second-password",
      role: "admin",
    });
    assert.equal(createdAdmin.status, 201);
    assert.equal(createdAdmin.body.user.role, "admin");
    assert.equal(await User.countDocuments({ role: "admin" }), 2);
    assert.equal(await guardRevision(), before + 2);

    const login = await request(app).post("/api/auth/login").send({ username: "NEW.STAFF", password: "test-only-new-password" });
    assert.equal(login.status, 200);
    assert.equal(login.body.user.role, "user");
  });

  test("rejects duplicates and invalid input without writing", async () => {
    const cookie = cookieFor(admin);
    const duplicateUsername = await request(app).post("/api/users").set("Cookie", cookie)
      .send({ ...newEmployee, username: " EMPLOYEE " });
    assert.equal(duplicateUsername.status, 409);
    assert.deepEqual(duplicateUsername.body, { error: "That username is already in use." });

    const duplicateEmail = await request(app).post("/api/users").set("Cookie", cookie)
      .send({ ...newEmployee, email: "USER@baore.com" });
    assert.equal(duplicateEmail.status, 409);
    assert.deepEqual(duplicateEmail.body, { error: "That email is already in use." });

    const invalid = [
      [{ ...newEmployee, role: "employee" }, "Role must be admin or user."],
      [{ ...newEmployee, email: "not-an-email" }, "Enter a valid email address."],
      [{ ...newEmployee, username: "a b" }, /Username must be/],
      [{ ...newEmployee, password: "short" }, "Password must be at least 8 characters."],
      [{ ...newEmployee, password: "é".repeat(40) }, "Password must be 72 bytes or fewer."],
      [{ ...newEmployee, name: "   " }, "Name is required."],
      [{ ...newEmployee, passwordHash: "x" }, "Invalid request."],
      [{ name: "Only Name" }, /required/],
    ];
    for (const [body, message] of invalid) {
      const response = await request(app).post("/api/users").set("Cookie", cookie).send(body);
      assert.equal(response.status, 400, JSON.stringify(body));
      if (message instanceof RegExp) assert.match(response.body.error, message);
      else assert.equal(response.body.error, message);
    }

    const malformed = await request(app).post("/api/users").set("Cookie", cookie)
      .set("Content-Type", "application/json").send("{bad json");
    assert.equal(malformed.status, 400);
    assert.equal(await User.countDocuments(), 2);
  });

  test("updates details, preserves the password hash, and rejects bad updates", async () => {
    const cookie = cookieFor(admin);
    const original = await User.findById(employee._id).select("+passwordHash");

    const updated = await request(app).patch(`/api/users/${employee._id}`).set("Cookie", cookie)
      .send({ name: " Renamed Staff ", username: "Renamed", email: "Renamed@Baore.com" });
    assert.equal(updated.status, 200);
    assert.deepEqual(
      { name: updated.body.user.name, username: updated.body.user.username, email: updated.body.user.email },
      { name: "Renamed Staff", username: "renamed", email: "renamed@baore.com" },
    );
    assertNoHash(updated);
    const stored = await User.findById(employee._id).select("+passwordHash");
    assert.equal(stored.passwordHash, original.passwordHash);

    const unchangedOwnName = await request(app).patch(`/api/users/${employee._id}`).set("Cookie", cookie)
      .send({ username: "renamed" });
    assert.equal(unchangedOwnName.status, 200);

    const duplicate = await request(app).patch(`/api/users/${employee._id}`).set("Cookie", cookie)
      .send({ email: "ADMIN@baore.com" });
    assert.equal(duplicate.status, 409);

    const checks = [
      [`/api/users/not-an-id`, { name: "X" }, 400, "Invalid account id."],
      [`/api/users/${employee._id}`, {}, 400, "Send at least one field to update."],
      [`/api/users/${employee._id}`, { password: "test-only-new-password" }, 400, "Invalid request."],
      [`/api/users/${employee._id}`, { role: "owner" }, 400, "Role must be admin or user."],
      [`/api/users/${new mongoose.Types.ObjectId()}`, { name: "X" }, 404, "Account not found."],
    ];
    for (const [path, body, status, message] of checks) {
      const response = await request(app).patch(path).set("Cookie", cookie).send(body);
      assert.equal(response.status, status, path);
      assert.equal(response.body.error, message);
    }
  });

  test("promotes and demotes, and role changes apply to the next request", async () => {
    const cookie = cookieFor(admin);
    const employeeCookie = cookieFor(employee);

    const promoted = await request(app).patch(`/api/users/${employee._id}`).set("Cookie", cookie).send({ role: "admin" });
    assert.equal(promoted.status, 200);
    assert.equal(promoted.body.user.role, "admin");
    const nowAllowed = await request(app).get("/api/users").set("Cookie", employeeCookie);
    assert.equal(nowAllowed.status, 200);

    const demoted = await request(app).patch(`/api/users/${employee._id}`).set("Cookie", cookie).send({ role: "user" });
    assert.equal(demoted.status, 200);
    assert.equal(demoted.body.user.role, "user");
    const deniedAgain = await request(app).get("/api/users").set("Cookie", employeeCookie);
    assert.equal(deniedAgain.status, 403);
  });

  test("protects the last admin and the caller's own admin access", async () => {
    const cookie = cookieFor(admin);
    const selfDemote = await request(app).patch(`/api/users/${admin._id}`).set("Cookie", cookie).send({ role: "user" });
    assert.equal(selfDemote.status, 403);
    assert.equal(selfDemote.body.error, "You cannot remove your own administrator access.");

    const selfDelete = await request(app).delete(`/api/users/${admin._id}`).set("Cookie", cookie);
    assert.equal(selfDelete.status, 403);
    const upperCaseSelfDelete = await request(app)
      .delete(`/api/users/${String(admin._id).toUpperCase()}`).set("Cookie", cookie);
    assert.equal(upperCaseSelfDelete.status, 403);

    const lastAdminDemote = await runAdminMembershipChange(async (session) => {
      await User.updateOne({ _id: admin._id }, { role: "user" }, { session });
    }).then(() => null, (error) => error);
    assert.equal(lastAdminDemote?.statusCode, 409);
    assert.equal(lastAdminDemote.message, "Keep at least one administrator account.");

    const lastAdminDelete = await runAdminMembershipChange(async (session) => {
      await User.deleteOne({ _id: admin._id }, { session });
    }).then(() => null, (error) => error);
    assert.equal(lastAdminDelete?.statusCode, 409);

    const stored = await User.findById(admin._id);
    assert.equal(stored.role, "admin");
    assert.equal(await User.countDocuments({ role: "admin" }), 1);
  });

  test("deletes another account and its session stops working", async () => {
    const employeeCookie = cookieFor(employee);
    const deleted = await request(app).delete(`/api/users/${employee._id}`).set("Cookie", cookieFor(admin));
    assert.equal(deleted.status, 200);
    assert.deepEqual(deleted.body, { message: "Account deleted." });
    assert.equal(await User.exists({ _id: employee._id }), null);

    const me = await request(app).get("/api/auth/me").set("Cookie", employeeCookie);
    assert.equal(me.status, 401);

    const missing = await request(app).delete(`/api/users/${employee._id}`).set("Cookie", cookieFor(admin));
    assert.equal(missing.status, 404);

    const second = await addAdmin("second");
    const deletedAdmin = await request(app).delete(`/api/users/${second._id}`).set("Cookie", cookieFor(admin));
    assert.equal(deletedAdmin.status, 200);
    assert.equal(await User.countDocuments({ role: "admin" }), 1);
  });

  test("resets a password with bcrypt and signs out that account's sessions", async () => {
    const employeeCookie = cookieFor(employee);
    const reset = await request(app).patch(`/api/users/${employee._id}/password`)
      .set("Cookie", cookieFor(admin)).send({ password: "test-only-reset-password" });
    assert.equal(reset.status, 200);
    assert.equal(reset.body.user.id, String(employee._id));
    assertNoHash(reset);
    assert.equal(JSON.stringify(reset.body).includes("test-only-reset-password"), false);
    assert.equal(cookieFromResponse(reset), null);

    const stored = await User.findById(employee._id).select("+passwordHash");
    assert.equal(await bcrypt.compare("test-only-reset-password", stored.passwordHash), true);
    assert.equal(await bcrypt.compare("test-only-employee-password", stored.passwordHash), false);
    assert.equal(bcrypt.getRounds(stored.passwordHash), 4);
    assert.equal(stored.sessionVersion, 1);

    const oldSession = await request(app).get("/api/auth/me").set("Cookie", employeeCookie);
    assert.equal(oldSession.status, 401);

    const oldPassword = await request(app).post("/api/auth/login")
      .send({ username: "employee", password: "test-only-employee-password" });
    assert.equal(oldPassword.status, 401);
    const newLogin = await request(app).post("/api/auth/login")
      .send({ username: "employee", password: "test-only-reset-password" });
    assert.equal(newLogin.status, 200);
    const fresh = await request(app).get("/api/auth/me").set("Cookie", cookieFromResponse(newLogin));
    assert.equal(fresh.status, 200);

    const invalid = await request(app).patch(`/api/users/${employee._id}/password`)
      .set("Cookie", cookieFor(admin)).send({ password: "short" });
    assert.equal(invalid.status, 400);
    const missing = await request(app).patch(`/api/users/${new mongoose.Types.ObjectId()}/password`)
      .set("Cookie", cookieFor(admin)).send({ password: "test-only-reset-password" });
    assert.equal(missing.status, 404);
  });

  test("an admin resetting their own password keeps the current session only", async () => {
    const oldCookie = cookieFor(admin);
    const reset = await request(app).patch(`/api/users/${admin._id}/password`)
      .set("Cookie", oldCookie).send({ password: "test-only-admin-reset" });
    assert.equal(reset.status, 200);
    const newCookie = cookieFromResponse(reset);
    assert.ok(newCookie);
    assert.equal((await request(app).get("/api/auth/me").set("Cookie", newCookie)).status, 200);
    assert.equal((await request(app).get("/api/auth/me").set("Cookie", oldCookie)).status, 401);
  });

  test("tokens without a session version still match accounts at version 0", async () => {
    const legacy = `${AUTH_COOKIE_NAME}=${signAuthToken(admin._id, env)}`;
    const me = await request(app).get("/api/auth/me").set("Cookie", legacy);
    assert.equal(me.status, 200);
  });

  test("concurrent removals of the last two admins leave one admin", async () => {
    for (let round = 0; round < 5; round += 1) {
      await resetDatabase();
      const second = await addAdmin("second");
      const results = await Promise.allSettled([admin._id, second._id].map((id) => (
        runAdminMembershipChange(async (session) => {
          await User.updateOne({ _id: id }, { role: "user" }, { session });
        })
      )));
      const fulfilled = results.filter((result) => result.status === "fulfilled");
      const rejected = results.filter((result) => result.status === "rejected");
      assert.equal(fulfilled.length, 1);
      assert.equal(rejected.length, 1);
      assert.equal(rejected[0].reason.statusCode, 409);
      assert.equal(await User.countDocuments({ role: "admin" }), 1);
    }
  });

  test("concurrent delete and demote through the API never leave zero admins", async () => {
    for (let round = 0; round < 3; round += 1) {
      await resetDatabase();
      const second = await addAdmin("second");
      const third = await addAdmin("third");
      const responses = await Promise.all([
        request(app).delete(`/api/users/${second._id}`).set("Cookie", cookieFor(admin)),
        request(app).patch(`/api/users/${third._id}`).set("Cookie", cookieFor(second)).send({ role: "user" }),
        request(app).patch(`/api/users/${admin._id}`).set("Cookie", cookieFor(third)).send({ role: "user" }),
        request(app).delete(`/api/users/${third._id}`).set("Cookie", cookieFor(admin)),
      ]);
      for (const response of responses) {
        assert.ok([200, 401, 403, 404, 409].includes(response.status), `unexpected ${response.status}`);
        assertNoHash(response);
      }
      assert.ok(await User.countDocuments({ role: "admin" }) >= 1);
    }
  });

  test("concurrent creates all commit through the guard and duplicates are rejected", async () => {
    const cookie = cookieFor(admin);
    const before = await guardRevision();
    const creates = await Promise.all(["admin1", "admin2", "admin3", "admin4"].map((name) => (
      request(app).post("/api/users").set("Cookie", cookie).send({
        name: `Admin ${name}`,
        username: name,
        email: `${name}@baore.com`,
        password: "test-only-other-password",
        role: "admin",
      })
    )));
    assert.deepEqual(creates.map((response) => response.status), [201, 201, 201, 201]);
    assert.equal(await guardRevision(), before + 4);

    const duplicates = await Promise.all([1, 2, 3].map(() => (
      request(app).post("/api/users").set("Cookie", cookie).send({ ...newEmployee })
    )));
    const statuses = duplicates.map((response) => response.status).sort();
    assert.deepEqual(statuses, [201, 409, 409]);
    assert.equal(await User.countDocuments({ username: "new.staff" }), 1);
  });

  test("a missing admin guard stops account changes without creating the guard", async () => {
    await AdminGuard.deleteOne({ _id: ADMIN_GUARD_ID });
    const response = await request(app).post("/api/users").set("Cookie", cookieFor(admin)).send(newEmployee);
    assert.equal(response.status, 503);
    assert.match(response.body.error, /guard record is missing/);
    assert.equal(await AdminGuard.countDocuments(), 0);
    assert.equal(await User.countDocuments(), 2);
  });
});
