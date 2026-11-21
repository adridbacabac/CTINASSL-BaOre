import assert from "node:assert/strict";
import express, { Router } from "express";
import mongoose from "mongoose";
import { after, describe, test } from "node:test";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import request from "supertest";
import { AUTH_COOKIE_NAME, signAuthToken, TOKEN_AUDIENCE, TOKEN_ISSUER } from "../src/auth/session.js";
import { errorHandler } from "../src/http/errors.js";
import { requireAuth } from "../src/middleware/requireAuth.js";
import { requireAdmin, requireAdminOrUser, requireRole } from "../src/middleware/requireRole.js";
import { User } from "../src/models/User.js";

const testUri = "mongodb://127.0.0.1:27017/baore_cosmetics_test?replicaSet=rs0";
const databaseName = new URL(testUri).pathname.replace(/^\//, "");
if (databaseName !== "baore_cosmetics_test") {
  throw new Error("Refusing to use a database other than baore_cosmetics_test.");
}

const jwtSecret = "test-only-jwt-secret-that-is-long-enough";
const env = {
  nodeEnv: "test",
  clientOrigin: "http://localhost:5173",
  jwtSecret,
  jwtExpiresInSeconds: 3600,
  jwtMaxAgeMs: 3600 * 1000,
};

function createProbeApp() {
  const app = express();
  const router = Router();
  router.get("/admin", requireAuth(env), requireAdmin, (req, res) => {
    res.json({ role: req.user.role });
  });
  router.post("/admin", requireAuth(env), requireAdmin, (req, res) => {
    res.json({ role: req.user.role });
  });
  router.get("/account", requireAuth(env), (req, res) => {
    res.json({ role: req.user.role });
  });
  router.get("/shared", requireAuth(env), requireAdminOrUser, (req, res) => {
    res.json({ role: req.user.role });
  });
  router.get("/employee-only", requireAuth(env), requireRole("user"), (req, res) => {
    res.json({ role: req.user.role });
  });
  router.get("/role-without-auth", requireRole("admin"), (req, res) => {
    res.json({ role: req.user?.role ?? null });
  });
  app.use(express.json());
  app.use("/probe", router);
  app.use(errorHandler);
  return app;
}

function cookieFor(userId, token = signAuthToken(userId, env)) {
  return `${AUTH_COOKIE_NAME}=${token}`;
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

describe("role authorization", { concurrency: 1 }, () => {
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

  test("rejects empty and unknown role configuration", () => {
    assert.throws(() => requireRole(), /database roles/);
    assert.throws(() => requireRole("employee"), /database roles/);
    assert.throws(() => requireRole("admin", ""), /database roles/);
    assert.throws(() => requireRole("admin", "employee"), /database roles/);
    assert.equal(typeof requireAdmin, "function");
    assert.equal(typeof requireAdminOrUser, "function");
  });

  test("authorizes from the database role and ignores forged roles", async () => {
    await useTestDb(async () => {
      await createAccounts();
      const app = createProbeApp();
      const admin = await User.findOne({ username: "admin" });
      const employee = await User.findOne({ username: "employee" });
      const adminCookie = cookieFor(admin._id);
      const employeeCookie = cookieFor(employee._id);

      const missingAdmin = await request(app).get("/probe/admin");
      const missingAccount = await request(app).get("/probe/account");
      assert.equal(missingAdmin.status, 401);
      assert.equal(missingAccount.status, 401);
      assert.deepEqual(missingAdmin.body, { error: "Authentication required." });
      assert.deepEqual(missingAccount.body, missingAdmin.body);

      const adminAllowed = await request(app).get("/probe/admin").set("Cookie", adminCookie);
      assert.equal(adminAllowed.status, 200);
      assert.deepEqual(adminAllowed.body, { role: "admin" });

      const employeeDenied = await request(app).get("/probe/admin").set("Cookie", employeeCookie);
      assert.equal(employeeDenied.status, 403);
      assert.deepEqual(employeeDenied.body, { error: "You do not have access to this action." });

      const adminAccount = await request(app).get("/probe/account").set("Cookie", adminCookie);
      const employeeAccount = await request(app).get("/probe/account").set("Cookie", employeeCookie);
      assert.equal(adminAccount.status, 200);
      assert.equal(employeeAccount.status, 200);
      assert.deepEqual(adminAccount.body, { role: "admin" });
      assert.deepEqual(employeeAccount.body, { role: "user" });

      const sharedAdmin = await request(app).get("/probe/shared").set("Cookie", adminCookie);
      const sharedEmployee = await request(app).get("/probe/shared").set("Cookie", employeeCookie);
      assert.equal(sharedAdmin.status, 200);
      assert.equal(sharedEmployee.status, 200);
      assert.deepEqual(sharedAdmin.body, { role: "admin" });
      assert.deepEqual(sharedEmployee.body, { role: "user" });

      const employeeOnly = await request(app).get("/probe/employee-only").set("Cookie", employeeCookie);
      const adminExcluded = await request(app).get("/probe/employee-only").set("Cookie", adminCookie);
      assert.equal(employeeOnly.status, 200);
      assert.deepEqual(employeeOnly.body, { role: "user" });
      assert.equal(adminExcluded.status, 403);

      const roleOnly = await request(app).get("/probe/role-without-auth").set("Cookie", adminCookie);
      assert.equal(roleOnly.status, 401);

      const forged = jwt.sign({ role: "admin" }, jwtSecret, {
        algorithm: "HS256",
        subject: String(employee._id),
        expiresIn: 3600,
        issuer: TOKEN_ISSUER,
        audience: TOKEN_AUDIENCE,
      });
      const forgedAdmin = await request(app).get("/probe/admin").set("Cookie", cookieFor(employee._id, forged));
      const forgedAccount = await request(app).get("/probe/account").set("Cookie", cookieFor(employee._id, forged));
      assert.equal(forgedAdmin.status, 403);
      assert.equal(forgedAccount.status, 200);
      assert.deepEqual(forgedAccount.body, { role: "user" });

      const overridden = await request(app)
        .post("/probe/admin")
        .set("Cookie", employeeCookie)
        .set("X-User-Role", "admin")
        .set("Role", "admin")
        .send({ role: "admin" });
      assert.equal(overridden.status, 403);
      assert.equal(JSON.stringify(overridden.body).includes("passwordHash"), false);

      await User.updateOne({ _id: employee._id }, { role: "admin" });
      const promoted = await request(app).get("/probe/admin").set("Cookie", employeeCookie);
      assert.equal(promoted.status, 200);
      assert.deepEqual(promoted.body, { role: "admin" });

      await User.updateOne({ _id: employee._id }, { role: "user" });
      const demoted = await request(app).get("/probe/admin").set("Cookie", employeeCookie);
      assert.equal(demoted.status, 403);
      const stillEmployee = await User.findById(employee._id);
      assert.equal(stillEmployee.role, "user");
    });
  });
});
