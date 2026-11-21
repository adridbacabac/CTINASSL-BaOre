import assert from "node:assert/strict";
import { after, before, beforeEach, describe, test } from "node:test";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import request from "supertest";
import { createApp } from "../src/app.js";
import { AUTH_COOKIE_NAME, signAuthToken } from "../src/auth/session.js";
import { Product } from "../src/models/Product.js";
import { StockMovement } from "../src/models/StockMovement.js";
import { User } from "../src/models/User.js";

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
let lipstick;

function assertDatabase() {
  if (mongoose.connection.name !== "baore_cosmetics_test") {
    throw new Error(`Refusing to use database ${mongoose.connection.name}`);
  }
}

function cookieFor(user) {
  return `${AUTH_COOKIE_NAME}=${signAuthToken(user._id, env, user.sessionVersion ?? 0)}`;
}

function assertSafe(response) {
  const body = JSON.stringify(response.body);
  assert.equal(body.includes("passwordHash"), false);
  assert.equal(body.includes("__v"), false);
  assert.equal(body.includes("\"_id\""), false);
}

async function resetDatabase() {
  assertDatabase();
  await mongoose.connection.dropDatabase();
  await Promise.all([User.createIndexes(), Product.createIndexes(), StockMovement.createIndexes()]);
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
  lipstick = await Product.create({
    name: "Velvet Matte Lipstick",
    category: "Lips",
    sku: "LIP-001",
    quantity: 10,
    price: 399,
    shade: "Rosewood",
  });
}

async function rejectAllMovementInserts() {
  await mongoose.connection.db.command({
    collMod: "stockMovements",
    validator: { $expr: { $eq: [1, 0] } },
    validationAction: "error",
  });
}

describe("stock movement API", { concurrency: 1 }, () => {
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

  test("rejects unauthenticated requests", async () => {
    const responses = await Promise.all([
      request(app).get("/api/movements"),
      request(app).get("/api/movements/mine"),
      request(app).post("/api/movements").send({ productId: String(lipstick._id), type: "stock_in", quantity: 1 }),
    ]);
    for (const response of responses) {
      assert.equal(response.status, 401);
      assert.deepEqual(response.body, { error: "Authentication required." });
    }
    assert.equal((await Product.findById(lipstick._id)).quantity, 10);
    assert.equal(await StockMovement.countDocuments(), 0);
  });

  test("employees record stock in and stock out, and cannot use admin types or list every movement", async () => {
    const cookie = cookieFor(employee);
    const productId = String(lipstick._id);

    const stockIn = await request(app).post("/api/movements").set("Cookie", cookie)
      .send({ productId, type: "stock_in", quantity: 3, note: "  Received  " });
    assert.equal(stockIn.status, 201);
    assert.equal(stockIn.body.movement.type, "stock_in");
    assert.equal(stockIn.body.movement.quantity, 3);
    assert.equal(stockIn.body.movement.quantityBefore, 10);
    assert.equal(stockIn.body.movement.quantityAfter, 13);
    assert.equal(stockIn.body.movement.note, "Received");
    assert.equal(stockIn.body.movement.productName, "Velvet Matte Lipstick");
    assert.equal(stockIn.body.movement.sku, "LIP-001");
    assert.equal(stockIn.body.movement.userId, String(employee._id));
    assert.equal(Object.hasOwn(stockIn.body.movement, "direction"), false);
    assertSafe(stockIn);

    const stockOut = await request(app).post("/api/movements").set("Cookie", cookie)
      .send({ productId, type: "stock_out", quantity: 4 });
    assert.equal(stockOut.status, 201);
    assert.equal(stockOut.body.movement.quantityBefore, 13);
    assert.equal(stockOut.body.movement.quantityAfter, 9);
    assert.equal((await Product.findById(lipstick._id)).quantity, 9);

    for (const type of ["restock", "sale", "return"]) {
      const denied = await request(app).post("/api/movements").set("Cookie", cookie).send({ productId, type, quantity: 1 });
      assert.equal(denied.status, 403, type);
      assert.deepEqual(denied.body, { error: "You do not have access to this action." });
    }
    const adjustment = await request(app).post("/api/movements").set("Cookie", cookie)
      .send({ productId, type: "adjustment", quantity: 1, direction: "out" });
    assert.equal(adjustment.status, 403);

    const all = await request(app).get("/api/movements").set("Cookie", cookie);
    assert.equal(all.status, 403);
    const mine = await request(app).get("/api/movements/mine").set("Cookie", cookie);
    assert.equal(mine.status, 200);
    assert.deepEqual(mine.body.movements.map((movement) => movement.type), ["stock_out", "stock_in"]);
    assert.equal((await Product.findById(lipstick._id)).quantity, 9);
  });

  test("admins record restock, sale, return, and adjustments, and cannot use employee types", async () => {
    const cookie = cookieFor(admin);
    const productId = String(lipstick._id);
    const cases = [
      [{ type: "restock", quantity: 5, note: "Shipment" }, 15],
      [{ type: "sale", quantity: 2 }, 13],
      [{ type: "return", quantity: 1 }, 14],
      [{ type: "adjustment", quantity: 3, direction: "out" }, 11],
      [{ type: "adjustment", quantity: 2, direction: "in" }, 13],
    ];
    for (const [body, expected] of cases) {
      const response = await request(app).post("/api/movements").set("Cookie", cookie).send({ productId, ...body });
      assert.equal(response.status, 201, body.type);
      assert.equal(response.body.movement.quantityAfter, expected);
      assert.equal(response.body.movement.productName, "Velvet Matte Lipstick");
      assert.equal(response.body.movement.sku, "LIP-001");
      assert.equal(response.body.movement.userId, String(admin._id));
      if (body.direction) assert.equal(response.body.movement.direction, body.direction);
      else assert.equal(Object.hasOwn(response.body.movement, "direction"), false);
    }
    assert.equal((await Product.findById(lipstick._id)).quantity, 13);
    const stored = await Product.findById(lipstick._id);
    assert.ok(stored.updatedAt > lipstick.updatedAt);

    for (const type of ["stock_in", "stock_out"]) {
      const denied = await request(app).post("/api/movements").set("Cookie", cookie).send({ productId, type, quantity: 1 });
      assert.equal(denied.status, 403, type);
    }
    assert.equal((await Product.findById(lipstick._id)).quantity, 13);

    const all = await request(app).get("/api/movements").set("Cookie", cookie);
    assert.equal(all.status, 200);
    assert.equal(all.body.movements.length, 5);
    assert.deepEqual(all.body.movements.map((movement) => movement.type), ["adjustment", "adjustment", "return", "sale", "restock"]);
    assertSafe(all);
    const mine = await request(app).get("/api/movements/mine").set("Cookie", cookie);
    assert.equal(mine.body.movements.length, 5);
    const employeeMine = await request(app).get("/api/movements/mine").set("Cookie", cookieFor(employee));
    assert.deepEqual(employeeMine.body.movements, []);
  });

  test("rejects invalid input without changing stock", async () => {
    const cookie = cookieFor(admin);
    const productId = String(lipstick._id);
    const typeMessage = /Movement type must be one of/;
    const cases = [
      [{ type: "sale", quantity: 1 }, "Product is required."],
      [{ productId: "not-an-id", type: "sale", quantity: 1 }, "Invalid product id."],
      [{ productId, quantity: 1 }, typeMessage],
      [{ productId, type: "transfer", quantity: 1 }, typeMessage],
      [{ productId, type: "sale", quantity: 0 }, "Quantity must be a positive whole number."],
      [{ productId, type: "sale", quantity: -2 }, "Quantity must be a positive whole number."],
      [{ productId, type: "sale", quantity: 1.5 }, "Quantity must be a positive whole number."],
      [{ productId, type: "sale", quantity: "2" }, "Quantity must be a positive whole number."],
      [{ productId, type: "adjustment", quantity: 1 }, "Direction must be in or out for an adjustment."],
      [{ productId, type: "adjustment", quantity: 1, direction: "sideways" }, "Direction must be in or out."],
      [{ productId, type: "sale", quantity: 1, direction: "out" }, "Direction is only allowed for an adjustment."],
      [{ productId, type: "sale", quantity: 1, quantityAfter: 0 }, "Invalid request."],
      [{ productId, type: "sale", quantity: 1, note: 12 }, "Note must be text."],
    ];
    for (const [body, message] of cases) {
      const response = await request(app).post("/api/movements").set("Cookie", cookie).send(body);
      assert.equal(response.status, 400, JSON.stringify(body));
      if (message instanceof RegExp) assert.match(response.body.error, message);
      else assert.equal(response.body.error, message);
    }
    const malformed = await request(app).post("/api/movements").set("Cookie", cookie)
      .set("Content-Type", "application/json").send("{bad json");
    assert.equal(malformed.status, 400);
    assert.equal((await Product.findById(lipstick._id)).quantity, 10);
    assert.equal(await StockMovement.countDocuments(), 0);
  });

  test("missing products return 404 and too much stock out returns 409", async () => {
    const cookie = cookieFor(employee);
    const missing = await request(app).post("/api/movements").set("Cookie", cookie)
      .send({ productId: String(new mongoose.Types.ObjectId()), type: "stock_out", quantity: 1 });
    assert.equal(missing.status, 404);
    assert.deepEqual(missing.body, { error: "Product not found." });

    const tooMany = await request(app).post("/api/movements").set("Cookie", cookie)
      .send({ productId: String(lipstick._id), type: "stock_out", quantity: 11 });
    assert.equal(tooMany.status, 409);
    assert.deepEqual(tooMany.body, { error: "There is not enough stock for that movement." });

    const exact = await request(app).post("/api/movements").set("Cookie", cookieFor(admin))
      .send({ productId: String(lipstick._id), type: "sale", quantity: 10 });
    assert.equal(exact.status, 201);
    assert.equal(exact.body.movement.quantityBefore, 10);
    assert.equal(exact.body.movement.quantityAfter, 0);
    const belowZero = await request(app).post("/api/movements").set("Cookie", cookieFor(admin))
      .send({ productId: String(lipstick._id), type: "adjustment", quantity: 1, direction: "out" });
    assert.equal(belowZero.status, 409);

    assert.equal((await Product.findById(lipstick._id)).quantity, 0);
    assert.equal(await StockMovement.countDocuments(), 1);
  });

  test("keeps the original snapshots after a rename and a delete", async () => {
    const cookie = cookieFor(admin);
    const productId = String(lipstick._id);
    const recorded = await request(app).post("/api/movements").set("Cookie", cookie)
      .send({ productId, type: "sale", quantity: 2, note: "Counter sale" });
    assert.equal(recorded.status, 201);

    const renamed = await request(app).patch(`/api/products/${productId}`).set("Cookie", cookie)
      .send({ name: "Renamed Lipstick", sku: "LIP-100" });
    assert.equal(renamed.status, 200);
    const later = await request(app).post("/api/movements").set("Cookie", cookie)
      .send({ productId, type: "restock", quantity: 1 });
    assert.equal(later.body.movement.productName, "Renamed Lipstick");
    assert.equal(later.body.movement.sku, "LIP-100");

    const deleted = await request(app).delete(`/api/products/${productId}`).set("Cookie", cookie);
    assert.equal(deleted.status, 200);

    const history = await request(app).get("/api/movements").set("Cookie", cookie);
    assert.equal(history.status, 200);
    const sale = history.body.movements.find((movement) => movement.type === "sale");
    const restock = history.body.movements.find((movement) => movement.type === "restock");
    assert.equal(sale.productName, "Velvet Matte Lipstick");
    assert.equal(sale.sku, "LIP-001");
    assert.equal(sale.quantityBefore, 10);
    assert.equal(sale.quantityAfter, 8);
    assert.equal(sale.note, "Counter sale");
    assert.equal(restock.productName, "Renamed Lipstick");
    assert.equal(restock.sku, "LIP-100");
    assert.equal(await Product.exists({ _id: lipstick._id }), null);
  });

  test("a failed movement insert rolls the quantity back", async () => {
    await rejectAllMovementInserts();
    const response = await request(app).post("/api/movements").set("Cookie", cookieFor(employee))
      .send({ productId: String(lipstick._id), type: "stock_in", quantity: 4 });
    assert.equal(response.status, 500);
    assert.deepEqual(response.body, { error: "Internal server error" });
    assert.equal((await Product.findById(lipstick._id)).quantity, 10);
    assert.equal(await StockMovement.countDocuments(), 0);
  });

  test("concurrent stock-outs of the last units leave a consistent quantity and history", async () => {
    await Product.updateOne({ _id: lipstick._id }, { quantity: 1 });
    const cookie = cookieFor(employee);
    const responses = await Promise.all([1, 2].map(() => (
      request(app).post("/api/movements").set("Cookie", cookie)
        .send({ productId: String(lipstick._id), type: "stock_out", quantity: 1 })
    )));
    assert.deepEqual(responses.map((response) => response.status).sort(), [201, 409]);
    assert.equal((await Product.findById(lipstick._id)).quantity, 0);
    const movements = await StockMovement.find({ productId: lipstick._id }).lean();
    assert.equal(movements.length, 1);
    assert.equal(movements[0].quantityBefore, 1);
    assert.equal(movements[0].quantityAfter, 0);

    const mixed = await Promise.all([
      request(app).post("/api/movements").set("Cookie", cookieFor(admin))
        .send({ productId: String(lipstick._id), type: "restock", quantity: 5 }),
      request(app).post("/api/movements").set("Cookie", cookieFor(admin))
        .send({ productId: String(lipstick._id), type: "sale", quantity: 2 }),
    ]);
    for (const response of mixed) assert.ok([201, 409].includes(response.status), String(response.status));
    const stored = await Product.findById(lipstick._id);
    const recorded = await StockMovement.find({ productId: lipstick._id }).lean();
    const net = recorded.reduce((sum, movement) => sum + (movement.quantityAfter - movement.quantityBefore), 0);
    assert.equal(stored.quantity, 1 + net);
    assert.ok(stored.quantity >= 0);
    assert.equal(recorded.length, mixed.filter((response) => response.status === 201).length + 1);
  });
});
