import assert from "node:assert/strict";
import mongoose from "mongoose";
import { after, describe, test } from "node:test";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import request from "supertest";
import { createApp } from "../src/app.js";
import { AUTH_COOKIE_NAME, TOKEN_AUDIENCE, TOKEN_ISSUER } from "../src/auth/session.js";
import { loadEnv } from "../src/config/env.js";
import { User } from "../src/models/User.js";

const testUri = "mongodb://127.0.0.1:27017/baore_cosmetics_test?replicaSet=rs0";
const databaseName = new URL(testUri).pathname.replace(/^\//, "");
if (databaseName !== "baore_cosmetics_test") {
  throw new Error("Refusing to use a database other than baore_cosmetics_test.");
}

const origin = "http://localhost:5173";
const jwtSecret = "test-only-jwt-secret-that-is-long-enough";
const adminPassword = "test-only-admin-password";
const employeePassword = "test-only-employee-password";

function appEnv(overrides = {}) {
  return {
    nodeEnv: "test",
    clientOrigin: origin,
    jwtSecret,
    jwtExpiresIn: "1h",
    jwtExpiresInSeconds: 3600,
    jwtMaxAgeMs: 3600 * 1000,
    loginRateLimit: { windowMs: 15 * 60 * 1000, limit: 100 },
    ...overrides,
  };
}

const baseServerEnv = {
  PORT: "5000",
  NODE_ENV: "test",
  MONGODB_URI: "mongodb://127.0.0.1:27017/baore_cosmetics?replicaSet=rs0",
  CLIENT_ORIGIN: origin,
  JWT_SECRET: jwtSecret,
  JWT_EXPIRES_IN: "8h",
};

function cookieHeader(response) {
  const header = response.headers["set-cookie"];
  assert.ok(header, "expected a Set-Cookie header");
  return (Array.isArray(header) ? header : [header]).join("\n");
}

function tokenFrom(response) {
  const header = cookieHeader(response);
  const match = header.match(new RegExp(`${AUTH_COOKIE_NAME}=([^;]+)`));
  assert.ok(match, "expected an authentication cookie");
  return decodeURIComponent(match[1]);
}

async function useTestDb(callback) {
  mongoose.set("autoCreate", false);
  mongoose.set("autoIndex", false);
  await mongoose.connect(testUri, { serverSelectionTimeoutMS: 8000, autoCreate: false, autoIndex: false });
  if (mongoose.connection.name !== "baore_cosmetics_test") {
    throw new Error(`Refusing to use database ${mongoose.connection.name}`);
  }
  try {
    return await callback();
  } finally {
    await mongoose.disconnect();
  }
}

async function createAccounts() {
  await mongoose.connection.dropDatabase();
  await User.create([
    {
      name: "Admin One",
      email: "admin@baore.com",
      username: "admin",
      passwordHash: await bcrypt.hash(adminPassword, 4),
      role: "admin",
    },
    {
      name: "User One",
      email: "user@baore.com",
      username: "employee",
      passwordHash: await bcrypt.hash(employeePassword, 4),
      role: "user",
    },
  ]);
}

describe("authentication api", { concurrency: 1 }, () => {
  after(async () => {
    mongoose.set("autoIndex", false);
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(testUri, { serverSelectionTimeoutMS: 8000 });
    }
    if (mongoose.connection.name !== "baore_cosmetics_test") {
      throw new Error(`Refusing to drop database ${mongoose.connection.name}`);
    }
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });

  test("requires a strong JWT secret without revealing it", () => {
    const weakSecret = "short-secret-value";
    assert.throws(() => loadEnv({ ...baseServerEnv, JWT_SECRET: "" }), /at least 32 characters/);
    assert.throws(() => loadEnv({ ...baseServerEnv, JWT_SECRET: weakSecret }), (error) => {
      assert.match(error.message, /at least 32 characters/);
      assert.equal(error.message.includes(weakSecret), false);
      return true;
    });
    assert.throws(() => loadEnv({
      ...baseServerEnv,
      JWT_SECRET: "replace-with-a-long-random-secret",
    }), (error) => {
      assert.match(error.message, /placeholder/);
      assert.equal(error.message.includes("replace-with-a-long-random-secret"), false);
      return true;
    });
    assert.throws(() => loadEnv({ ...baseServerEnv, JWT_SECRET: "a".repeat(40) }), /repeated character/);
    assert.throws(() => loadEnv({ ...baseServerEnv, JWT_EXPIRES_IN: "soon" }), /JWT_EXPIRES_IN/);
    assert.throws(() => loadEnv({ ...baseServerEnv, CLIENT_ORIGIN: "*" }), /CLIENT_ORIGIN/);

    const configured = loadEnv({ ...baseServerEnv, JWT_EXPIRES_IN: "" });
    assert.equal(configured.jwtExpiresIn, "8h");
    assert.equal(configured.jwtExpiresInSeconds, 8 * 60 * 60);
    assert.equal(configured.jwtMaxAgeMs, 8 * 60 * 60 * 1000);
    assert.equal(configured.loginRateLimit.limit, 10);
    assert.equal(configured.jwtSecret.length >= 32, true);
    assert.equal(configured.bcryptCost, 12);
    assert.equal(loadEnv({ ...baseServerEnv, BCRYPT_COST: "10" }).bcryptCost, 10);
    assert.throws(() => loadEnv({ ...baseServerEnv, BCRYPT_COST: "3" }), /BCRYPT_COST/);
    assert.throws(() => loadEnv({ ...baseServerEnv, BCRYPT_COST: "12.5" }), /BCRYPT_COST/);
  });

  test("allows only the exact configured origin with credentials", async () => {
    const devOrigin = "http://127.0.0.1:5177";
    const app = createApp(appEnv({ nodeEnv: "development", clientOrigin: devOrigin }));

    async function corsHeaders(target, requestOrigin) {
      const response = await request(target).get("/api/health").set("Origin", requestOrigin);
      return {
        origin: response.headers["access-control-allow-origin"],
        credentials: response.headers["access-control-allow-credentials"],
      };
    }

    const allowed = await corsHeaders(app, devOrigin);
    assert.equal(allowed.origin, devOrigin);
    assert.equal(allowed.credentials, "true");

    const preflight = await request(app)
      .options("/api/auth/login")
      .set("Origin", devOrigin)
      .set("Access-Control-Request-Method", "POST")
      .set("Access-Control-Request-Headers", "content-type");
    assert.equal(preflight.headers["access-control-allow-origin"], devOrigin);
    assert.equal(preflight.headers["access-control-allow-credentials"], "true");

    for (const rejected of [
      "http://127.0.0.1:5173",
      "http://localhost:5173",
      "http://localhost:5177",
      "https://127.0.0.1:5177",
      "http://evil.example",
      "null",
    ]) {
      const headers = await corsHeaders(app, rejected);
      assert.equal(headers.origin, undefined, rejected);
      assert.equal(headers.credentials, undefined, rejected);
    }

    const noOrigin = await request(app).get("/api/health");
    assert.equal(noOrigin.status, 503);
    assert.equal(noOrigin.headers["access-control-allow-origin"], undefined);

    const productionOrigin = "https://inventory.baore.example";
    const production = createApp(appEnv({ nodeEnv: "production", clientOrigin: productionOrigin }));
    const productionAllowed = await corsHeaders(production, productionOrigin);
    assert.equal(productionAllowed.origin, productionOrigin);
    assert.equal(productionAllowed.credentials, "true");
    for (const rejected of [devOrigin, "http://localhost:5173", "https://evil.example"]) {
      assert.equal((await corsHeaders(production, rejected)).origin, undefined, rejected);
    }

    for (const headers of [allowed, productionAllowed]) {
      assert.notEqual(headers.origin, "*");
    }
  });

  test("logs in both roles and keeps password hashes out of responses", async () => {
    await useTestDb(async () => {
      await createAccounts();
      const before = await User.findOne({ username: "admin" }).select("+passwordHash");
      const app = createApp(appEnv());

      const admin = await request(app).post("/api/auth/login").send({
        username: " Admin ",
        password: adminPassword,
      });
      assert.equal(admin.status, 200);
      assert.equal(admin.body.user.role, "admin");
      assert.equal(admin.body.user.username, "admin");
      assert.equal(admin.body.user.name, "Admin One");
      assert.equal(admin.body.user.email, "admin@baore.com");
      assert.equal(typeof admin.body.user.id, "string");
      assert.equal(admin.headers["x-content-type-options"], "nosniff");
      const adminCookie = cookieHeader(admin);
      assert.match(adminCookie, new RegExp(`${AUTH_COOKIE_NAME}=`));
      assert.match(adminCookie, /HttpOnly/i);
      assert.match(adminCookie, /SameSite=Lax/i);
      assert.match(adminCookie, /Path=\//i);
      assert.match(adminCookie, /Max-Age=3600/i);
      assert.doesNotMatch(adminCookie, /;\s*Secure/i);
      assert.equal(JSON.stringify(admin.body).includes("passwordHash"), false);
      assert.equal(JSON.stringify(admin.body).includes("$2"), false);
      assert.equal(adminCookie.includes(jwtSecret), false);

      const after = await User.findOne({ username: "admin" }).select("+passwordHash");
      assert.equal(after.passwordHash, before.passwordHash);

      const employee = await request(app).post("/api/auth/login").send({
        username: "Employee",
        password: employeePassword,
      });
      assert.equal(employee.status, 200);
      assert.deepEqual(employee.body.user, {
        id: employee.body.user.id,
        name: "User One",
        username: "employee",
        email: "user@baore.com",
        role: "user",
      });
      assert.equal(JSON.stringify(employee.body).includes("passwordHash"), false);

      const production = await request(createApp(appEnv({ nodeEnv: "production" })))
        .post("/api/auth/login")
        .send({ username: "admin", password: adminPassword });
      assert.match(cookieHeader(production), /;\s*Secure/i);
    });
  });

  test("returns one login error for a wrong password and an unknown username", async () => {
    await useTestDb(async () => {
      await createAccounts();
      const app = createApp(appEnv());
      const wrong = await request(app).post("/api/auth/login").send({
        username: "admin",
        password: "wrong-password",
      });
      const unknown = await request(app).post("/api/auth/login").send({
        username: "missing-person",
        password: "wrong-password",
      });
      assert.equal(wrong.status, 401);
      assert.equal(unknown.status, 401);
      assert.deepEqual(wrong.body, { error: "Invalid username or password." });
      assert.deepEqual(unknown.body, wrong.body);
      assert.equal(JSON.stringify(wrong.body).includes("wrong-password"), false);
      assert.equal(JSON.stringify(unknown.body).includes("passwordHash"), false);
    });
  });

  test("rejects missing and malformed login bodies", async () => {
    const app = createApp(appEnv());
    const cases = [
      {},
      { username: "admin" },
      { password: "secret-value" },
      { username: " ", password: "secret-value" },
      { username: "admin", password: "" },
      { username: "admin", password: 12 },
      { username: "admin", password: "secret-value", role: "admin" },
    ];
    for (const body of cases) {
      const response = await request(app).post("/api/auth/login").send(body);
      assert.equal(response.status, 400);
      assert.deepEqual(response.body, { error: "Invalid request." });
      assert.equal(JSON.stringify(response.body).includes("secret-value"), false);
    }

    const malformed = await request(app)
      .post("/api/auth/login")
      .set("Content-Type", "application/json")
      .send("{\"username\":");
    assert.equal(malformed.status, 400);
    assert.deepEqual(malformed.body, { error: "Invalid request." });
  });

  test("returns the current user and clears the cookie on logout", async () => {
    await useTestDb(async () => {
      await createAccounts();
      const app = createApp(appEnv());
      const agent = request.agent(app);
      const login = await agent.post("/api/auth/login").send({
        username: "admin",
        password: adminPassword,
      });
      const me = await agent.get("/api/auth/me");
      assert.equal(me.status, 200);
      assert.equal(me.body.user.id, login.body.user.id);
      assert.equal(me.body.user.role, "admin");
      assert.equal(JSON.stringify(me.body).includes("passwordHash"), false);

      const logout = await agent.post("/api/auth/logout");
      assert.equal(logout.status, 200);
      assert.deepEqual(logout.body, { message: "Logged out." });
      const cleared = cookieHeader(logout);
      assert.match(cleared, new RegExp(`${AUTH_COOKIE_NAME}=`));
      assert.match(cleared, /HttpOnly/i);
      assert.match(cleared, /SameSite=Lax/i);
      assert.match(cleared, /Path=\//i);
      assert.match(cleared, /Max-Age=0/i);
      assert.doesNotMatch(cleared, /;\s*Secure/i);

      const afterLogout = await agent.get("/api/auth/me");
      assert.equal(afterLogout.status, 401);
      assert.deepEqual(afterLogout.body, { error: "Authentication required." });
    });
  });

  test("rejects a missing, invalid, or expired token and a deleted account", async () => {
    await useTestDb(async () => {
      await createAccounts();
      const app = createApp(appEnv());
      const missing = await request(app).get("/api/auth/me");
      assert.equal(missing.status, 401);
      assert.deepEqual(missing.body, { error: "Authentication required." });

      const invalid = await request(app).get("/api/auth/me").set("Cookie", `${AUTH_COOKIE_NAME}=not-a-token`);
      assert.equal(invalid.status, 401);
      assert.deepEqual(invalid.body, missing.body);

      const admin = await User.findOne({ username: "admin" });
      const forged = jwt.sign({}, "different-test-secret-that-is-long-enough", {
        algorithm: "HS256",
        subject: String(admin._id),
        expiresIn: 3600,
        issuer: TOKEN_ISSUER,
        audience: TOKEN_AUDIENCE,
      });
      const badSignature = await request(app).get("/api/auth/me").set("Cookie", `${AUTH_COOKIE_NAME}=${forged}`);
      assert.equal(badSignature.status, 401);

      const expired = jwt.sign({ exp: Math.floor(Date.now() / 1000) - 10 }, jwtSecret, {
        algorithm: "HS256",
        subject: String(admin._id),
        issuer: TOKEN_ISSUER,
        audience: TOKEN_AUDIENCE,
      });
      const expiredResponse = await request(app).get("/api/auth/me").set("Cookie", `${AUTH_COOKIE_NAME}=${expired}`);
      assert.equal(expiredResponse.status, 401);
      assert.deepEqual(expiredResponse.body, missing.body);

      const employee = await User.findOne({ username: "employee" });
      const staleRole = jwt.sign({ role: "admin" }, jwtSecret, {
        algorithm: "HS256",
        subject: String(employee._id),
        expiresIn: 3600,
        issuer: TOKEN_ISSUER,
        audience: TOKEN_AUDIENCE,
      });
      const current = await request(app).get("/api/auth/me").set("Cookie", `${AUTH_COOKIE_NAME}=${staleRole}`);
      assert.equal(current.status, 200);
      assert.equal(current.body.user.role, "user");
      assert.equal(current.body.user.username, "employee");

      await User.deleteOne({ _id: employee._id });
      const deleted = await request(app).get("/api/auth/me").set("Cookie", `${AUTH_COOKIE_NAME}=${staleRole}`);
      assert.equal(deleted.status, 401);
      assert.deepEqual(deleted.body, missing.body);
    });
  });

  test("rate limits repeated login attempts", async () => {
    await useTestDb(async () => {
      await createAccounts();
      const app = createApp(appEnv({ loginRateLimit: { windowMs: 60 * 1000, limit: 2 } }));
      const first = await request(app).post("/api/auth/login").send({ username: "admin", password: "wrong-password" });
      const second = await request(app).post("/api/auth/login").send({ username: "admin", password: "wrong-password" });
      const third = await request(app).post("/api/auth/login").send({ username: "admin", password: "wrong-password" });
      assert.equal(first.status, 401);
      assert.equal(second.status, 401);
      assert.equal(third.status, 429);
      assert.deepEqual(third.body, { error: "Too many login attempts." });
      assert.equal(JSON.stringify(third.body).includes("wrong-password"), false);
    });
  });
});
