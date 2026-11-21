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
let blush;

const PRODUCT_FIELDS = [
  "brand", "category", "createdAt", "id", "name", "price", "quantity", "shade", "sku", "stockStatus", "updatedAt",
].sort();

const newProduct = {
  name: "  Glow Serum  ",
  category: "Skincare",
  sku: " skn-100 ",
  brand: "Ba'Oré",
  shade: "Clear",
  quantity: 12,
  price: 549.5,
};

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
  [lipstick, blush] = await Product.create([
    { name: "Velvet Matte Lipstick", category: "Lips", sku: "LIP-001", quantity: 28, price: 399, shade: "Rosewood" },
    { name: "Cloud Nine Blush", category: "Cheeks", sku: "CHK-003", quantity: 4, price: 349, shade: "Soft Peach" },
  ]);
}

async function rejectAllMovementInserts() {
  await mongoose.connection.db.command({
    collMod: "stockMovements",
    validator: { $expr: { $eq: [1, 0] } },
    validationAction: "error",
  });
}

describe("product API", { concurrency: 1 }, () => {
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

  describe("authentication and authorization", () => {
    test("rejects unauthenticated requests on every endpoint", async () => {
      const id = String(lipstick._id);
      const responses = await Promise.all([
        request(app).get("/api/products"),
        request(app).get(`/api/products/${id}`),
        request(app).post("/api/products").send(newProduct),
        request(app).patch(`/api/products/${id}`).send({ name: "Changed" }),
        request(app).delete(`/api/products/${id}`),
      ]);
      for (const response of responses) {
        assert.equal(response.status, 401);
        assert.deepEqual(response.body, { error: "Authentication required." });
      }
      assert.equal(await Product.countDocuments(), 2);
    });

    test("employees cannot create, edit, or delete products", async () => {
      const cookie = cookieFor(employee);
      const id = String(lipstick._id);
      const responses = await Promise.all([
        request(app).post("/api/products").set("Cookie", cookie).send(newProduct),
        request(app).patch(`/api/products/${id}`).set("Cookie", cookie).send({ name: "Changed" }),
        request(app).patch(`/api/products/${id}`).set("Cookie", cookie).send({ quantity: 999 }),
        request(app).delete(`/api/products/${id}`).set("Cookie", cookie),
      ]);
      for (const response of responses) {
        assert.equal(response.status, 403);
        assert.deepEqual(response.body, { error: "You do not have access to this action." });
      }
      const stored = await Product.findById(lipstick._id);
      assert.equal(stored.name, "Velvet Matte Lipstick");
      assert.equal(stored.quantity, 28);
      assert.equal(await Product.countDocuments(), 2);
      assert.equal(await StockMovement.countDocuments(), 0);
    });
  });

  describe("retrieval", () => {
    test("admins and employees can list products with derived stock status", async () => {
      for (const user of [admin, employee]) {
        const response = await request(app).get("/api/products").set("Cookie", cookieFor(user));
        assert.equal(response.status, 200);
        assert.equal(response.body.products.length, 2);
        assert.deepEqual(Object.keys(response.body.products[0]).sort(), PRODUCT_FIELDS);
        assert.deepEqual(response.body.products.map((product) => product.sku), ["LIP-001", "CHK-003"]);
        assert.deepEqual(response.body.products.map((product) => product.stockStatus), ["in_stock", "low_stock"]);
        assert.equal(response.body.products[0].brand, "Ba'Oré");
        assertSafe(response);
      }
    });

    test("filters by search text and category", async () => {
      const cookie = cookieFor(employee);
      const bySearch = await request(app).get("/api/products").query({ search: "rose" }).set("Cookie", cookie);
      assert.deepEqual(bySearch.body.products.map((product) => product.sku), ["LIP-001"]);
      const bySku = await request(app).get("/api/products").query({ search: "chk-" }).set("Cookie", cookie);
      assert.deepEqual(bySku.body.products.map((product) => product.sku), ["CHK-003"]);
      const regexText = await request(app).get("/api/products").query({ search: ".*" }).set("Cookie", cookie);
      assert.equal(regexText.body.products.length, 0);
      const byCategory = await request(app).get("/api/products").query({ category: "Cheeks" }).set("Cookie", cookie);
      assert.deepEqual(byCategory.body.products.map((product) => product.sku), ["CHK-003"]);

      const badCategory = await request(app).get("/api/products").query({ category: "Hair" }).set("Cookie", cookie);
      assert.equal(badCategory.status, 400);
      assert.match(badCategory.body.error, /Category must be one of/);
      const unknownQuery = await request(app).get("/api/products").query({ sort: "price" }).set("Cookie", cookie);
      assert.equal(unknownQuery.status, 400);
      assert.equal(unknownQuery.body.error, "Invalid request.");
    });

    test("admins and employees can retrieve one product", async () => {
      for (const user of [admin, employee]) {
        const response = await request(app).get(`/api/products/${blush._id}`).set("Cookie", cookieFor(user));
        assert.equal(response.status, 200);
        assert.equal(response.body.product.id, String(blush._id));
        assert.equal(response.body.product.sku, "CHK-003");
        assert.equal(response.body.product.quantity, 4);
        assert.equal(response.body.product.stockStatus, "low_stock");
        assert.deepEqual(Object.keys(response.body.product).sort(), PRODUCT_FIELDS);
        assertSafe(response);
      }
    });

    test("missing products return 404 and invalid ids return 400", async () => {
      const cookie = cookieFor(employee);
      const missing = await request(app).get(`/api/products/${new mongoose.Types.ObjectId()}`).set("Cookie", cookie);
      assert.equal(missing.status, 404);
      assert.deepEqual(missing.body, { error: "Product not found." });
      const invalid = await request(app).get("/api/products/not-an-id").set("Cookie", cookie);
      assert.equal(invalid.status, 400);
      assert.deepEqual(invalid.body, { error: "Invalid product id." });
    });
  });

  describe("creation", () => {
    test("admin creates a product with normalized fields and an opening stock movement", async () => {
      const response = await request(app).post("/api/products").set("Cookie", cookieFor(admin)).send(newProduct);
      assert.equal(response.status, 201);
      const { product } = response.body;
      assert.equal(product.name, "Glow Serum");
      assert.equal(product.sku, "SKN-100");
      assert.equal(product.category, "Skincare");
      assert.equal(product.quantity, 12);
      assert.equal(product.price, 549.5);
      assert.equal(product.stockStatus, "in_stock");
      assertSafe(response);

      const movements = await StockMovement.find({ productId: product.id }).lean();
      assert.equal(movements.length, 1);
      const [movement] = movements;
      assert.equal(movement.type, "restock");
      assert.equal(movement.note, "Opening stock");
      assert.equal(movement.quantity, 12);
      assert.equal(movement.quantityBefore, 0);
      assert.equal(movement.quantityAfter, 12);
      assert.equal(movement.productName, "Glow Serum");
      assert.equal(movement.sku, "SKN-100");
      assert.equal(String(movement.userId), String(admin._id));
      assert.equal(movement.direction, undefined);
    });

    test("applies brand and shade defaults and skips the movement for zero or omitted quantity", async () => {
      const cookie = cookieFor(admin);
      const zero = await request(app).post("/api/products").set("Cookie", cookie)
        .send({ name: "Brush Set", category: "Tools & Brushes", sku: "TLS-001", quantity: 0, price: 1299.99 });
      assert.equal(zero.status, 201);
      assert.equal(zero.body.product.brand, "Ba'Oré");
      assert.equal(zero.body.product.shade, "");
      assert.equal(zero.body.product.stockStatus, "out_of_stock");

      const omitted = await request(app).post("/api/products").set("Cookie", cookie)
        .send({ name: "Sponge", category: "Tools & Brushes", sku: "TLS-002", price: 99 });
      assert.equal(omitted.status, 201);
      assert.equal(omitted.body.product.quantity, 0);
      assert.equal(await StockMovement.countDocuments(), 0);
    });

    test("rejects invalid input without writing", async () => {
      const cookie = cookieFor(admin);
      const cases = [
        [{ ...newProduct, name: undefined }, "Product name is required."],
        [{ ...newProduct, name: "   " }, "Product name is required."],
        [{ ...newProduct, sku: undefined }, "SKU is required."],
        [{ ...newProduct, sku: "  " }, "SKU is required."],
        [{ ...newProduct, category: undefined }, /Category must be one of/],
        [{ ...newProduct, category: "Hair" }, /Category must be one of/],
        [{ ...newProduct, price: undefined }, /Price must be/],
        [{ ...newProduct, quantity: -1 }, "Quantity must be a nonnegative whole number."],
        [{ ...newProduct, quantity: 1.5 }, "Quantity must be a nonnegative whole number."],
        [{ ...newProduct, quantity: "5" }, "Quantity must be a nonnegative whole number."],
        [{ ...newProduct, quantity: 1e20 }, "Quantity must be a nonnegative whole number."],
        [{ ...newProduct, price: -1 }, /Price must be/],
        [{ ...newProduct, price: 10.999 }, /Price must be/],
        [{ ...newProduct, price: "10" }, /Price must be/],
        [{ ...newProduct, stockStatus: "in_stock" }, "Invalid request."],
        [{ ...newProduct, _id: String(new mongoose.Types.ObjectId()) }, "Invalid request."],
      ];
      for (const [body, message] of cases) {
        const response = await request(app).post("/api/products").set("Cookie", cookie).send(body);
        assert.equal(response.status, 400, JSON.stringify(body));
        if (message instanceof RegExp) assert.match(response.body.error, message);
        else assert.equal(response.body.error, message);
      }
      const array = await request(app).post("/api/products").set("Cookie", cookie).send([newProduct]);
      assert.equal(array.status, 400);
      const malformed = await request(app).post("/api/products").set("Cookie", cookie)
        .set("Content-Type", "application/json").send("{bad json");
      assert.equal(malformed.status, 400);
      assert.equal(await Product.countDocuments(), 2);
      assert.equal(await StockMovement.countDocuments(), 0);
    });

    test("duplicate SKUs return 409 regardless of case", async () => {
      const response = await request(app).post("/api/products").set("Cookie", cookieFor(admin))
        .send({ ...newProduct, sku: " lip-001 " });
      assert.equal(response.status, 409);
      assert.deepEqual(response.body, { error: "That SKU is already in use." });
      assert.equal(await Product.countDocuments({ sku: "LIP-001" }), 1);
      assert.equal(await StockMovement.countDocuments(), 0);
    });

    test("concurrent creates with the same SKU leave one product and one movement", async () => {
      const cookie = cookieFor(admin);
      const responses = await Promise.all([1, 2, 3].map(() => (
        request(app).post("/api/products").set("Cookie", cookie).send(newProduct)
      )));
      assert.deepEqual(responses.map((response) => response.status).sort(), [201, 409, 409]);
      assert.equal(await Product.countDocuments({ sku: "SKN-100" }), 1);
      assert.equal(await StockMovement.countDocuments({ sku: "SKN-100" }), 1);
    });

    test("a failed opening movement rolls back the product", async () => {
      await rejectAllMovementInserts();
      const cookie = cookieFor(admin);
      const failed = await request(app).post("/api/products").set("Cookie", cookie).send(newProduct);
      assert.equal(failed.status, 500);
      assert.deepEqual(failed.body, { error: "Internal server error" });
      assert.equal(await Product.countDocuments({ sku: "SKN-100" }), 0);
      assert.equal(await StockMovement.countDocuments(), 0);

      const zero = await request(app).post("/api/products").set("Cookie", cookie)
        .send({ ...newProduct, quantity: 0 });
      assert.equal(zero.status, 201);
      assert.equal(await Product.countDocuments({ sku: "SKN-100" }), 1);
    });
  });

  describe("editing", () => {
    test("admin edits permitted fields without touching quantity", async () => {
      const response = await request(app).patch(`/api/products/${lipstick._id}`).set("Cookie", cookieFor(admin))
        .send({ name: " Velvet Lipstick ", category: "Lips", sku: "lip-010", brand: "Ba'Oré Pro", shade: "Ruby", price: 425.75 });
      assert.equal(response.status, 200);
      assert.equal(response.body.product.name, "Velvet Lipstick");
      assert.equal(response.body.product.sku, "LIP-010");
      assert.equal(response.body.product.brand, "Ba'Oré Pro");
      assert.equal(response.body.product.shade, "Ruby");
      assert.equal(response.body.product.price, 425.75);
      assert.equal(response.body.product.quantity, 28);
      assertSafe(response);
      const stored = await Product.findById(lipstick._id);
      assert.equal(stored.quantity, 28);
      assert.ok(stored.updatedAt >= lipstick.updatedAt);
      assert.equal(await StockMovement.countDocuments(), 0);
    });

    test("rejects quantity edits instead of applying or ignoring them", async () => {
      const cookie = cookieFor(admin);
      for (const body of [{ quantity: 999 }, { name: "Renamed", quantity: 28 }, { quantity: null }]) {
        const response = await request(app).patch(`/api/products/${lipstick._id}`).set("Cookie", cookie).send(body);
        assert.equal(response.status, 400);
        assert.deepEqual(response.body, { error: "Quantity cannot be edited here. Record a stock movement to change it." });
      }
      const stored = await Product.findById(lipstick._id);
      assert.equal(stored.quantity, 28);
      assert.equal(stored.name, "Velvet Matte Lipstick");
    });

    test("rejects duplicate SKUs, missing products, bad ids, and invalid values", async () => {
      const cookie = cookieFor(admin);
      const duplicate = await request(app).patch(`/api/products/${lipstick._id}`).set("Cookie", cookie).send({ sku: "chk-003" });
      assert.equal(duplicate.status, 409);
      assert.deepEqual(duplicate.body, { error: "That SKU is already in use." });

      const sameSku = await request(app).patch(`/api/products/${lipstick._id}`).set("Cookie", cookie).send({ sku: "lip-001" });
      assert.equal(sameSku.status, 200);

      const checks = [
        [`/api/products/${new mongoose.Types.ObjectId()}`, { name: "X" }, 404, "Product not found."],
        ["/api/products/not-an-id", { name: "X" }, 400, "Invalid product id."],
        [`/api/products/${lipstick._id}`, {}, 400, "Send at least one field to update."],
        [`/api/products/${lipstick._id}`, { name: "" }, 400, "Product name is required."],
        [`/api/products/${lipstick._id}`, { category: "Hair" }, 400, /Category must be one of/],
        [`/api/products/${lipstick._id}`, { price: -5 }, 400, /Price must be/],
        [`/api/products/${lipstick._id}`, { price: 1.234 }, 400, /Price must be/],
        [`/api/products/${lipstick._id}`, { stockStatus: "out_of_stock" }, 400, "Invalid request."],
      ];
      for (const [path, body, status, message] of checks) {
        const response = await request(app).patch(path).set("Cookie", cookie).send(body);
        assert.equal(response.status, status, `${path} ${JSON.stringify(body)}`);
        if (message instanceof RegExp) assert.match(response.body.error, message);
        else assert.equal(response.body.error, message);
      }
      const stored = await Product.findById(lipstick._id);
      assert.equal(stored.price, 399);
      assert.equal(stored.category, "Lips");
    });
  });

  describe("deletion", () => {
    test("admin deletes a product and later lookups return 404", async () => {
      const cookie = cookieFor(admin);
      const deleted = await request(app).delete(`/api/products/${blush._id}`).set("Cookie", cookie);
      assert.equal(deleted.status, 200);
      assert.deepEqual(deleted.body, { message: "Product deleted." });
      assert.equal(await Product.exists({ _id: blush._id }), null);

      const lookup = await request(app).get(`/api/products/${blush._id}`).set("Cookie", cookie);
      assert.equal(lookup.status, 404);
      const again = await request(app).delete(`/api/products/${blush._id}`).set("Cookie", cookie);
      assert.equal(again.status, 404);
      const invalid = await request(app).delete("/api/products/not-an-id").set("Cookie", cookie);
      assert.equal(invalid.status, 400);
    });

    test("deleting a product keeps its movement history and snapshots", async () => {
      const cookie = cookieFor(admin);
      const created = await request(app).post("/api/products").set("Cookie", cookie).send(newProduct);
      const id = created.body.product.id;
      const renamed = await request(app).patch(`/api/products/${id}`).set("Cookie", cookie).send({ name: "Renamed Serum", sku: "SKN-200" });
      assert.equal(renamed.status, 200);

      const deleted = await request(app).delete(`/api/products/${id}`).set("Cookie", cookie);
      assert.equal(deleted.status, 200);
      assert.equal(await Product.exists({ _id: id }), null);

      const movements = await StockMovement.find({ productId: id }).lean();
      assert.equal(movements.length, 1);
      assert.equal(movements[0].productName, "Glow Serum");
      assert.equal(movements[0].sku, "SKN-100");
      assert.equal(movements[0].quantityBefore, 0);
      assert.equal(movements[0].quantityAfter, 12);
    });
  });
});
