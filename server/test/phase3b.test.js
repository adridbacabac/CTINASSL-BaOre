import assert from "node:assert/strict";
import fs from "fs";
import mongoose from "mongoose";
import { after, describe, test } from "node:test";
import bcrypt from "bcryptjs";
import { ADMIN_GUARD_ID } from "../src/models/constants.js";
import { AdminGuard } from "../src/models/AdminGuard.js";
import { deriveStockStatus, Product } from "../src/models/Product.js";
import { StockMovement } from "../src/models/StockMovement.js";
import { User } from "../src/models/User.js";
import { loadSeedConfig, runSeed, SeedConflictError } from "../src/seed/seed.js";

const testUri = "mongodb://127.0.0.1:27017/baore_cosmetics_test?replicaSet=rs0";
const adminPassword = "test-only-admin-password";
const employeePassword = "test-only-employee-password";
const seedEnv = {
  MONGODB_URI: testUri,
  SEED_ADMIN_PASSWORD: adminPassword,
  SEED_EMPLOYEE_PASSWORD: employeePassword,
  BCRYPT_COST: "4",
};

function productInput(overrides = {}) {
  return {
    name: "Sample Lipstick",
    category: "Lips",
    sku: "LIP-100",
    quantity: 6,
    price: 10.5,
    ...overrides,
  };
}

function movementInput(overrides = {}) {
  return {
    productId: new mongoose.Types.ObjectId(),
    userId: new mongoose.Types.ObjectId(),
    type: "sale",
    quantity: 2,
    quantityBefore: 6,
    quantityAfter: 4,
    productName: "Sample Lipstick",
    sku: "LIP-100",
    ...overrides,
  };
}

async function useTestDb(callback) {
  mongoose.set("autoIndex", false);
  await mongoose.connect(testUri, { serverSelectionTimeoutMS: 8000 });
  if (mongoose.connection.name !== "baore_cosmetics_test") {
    throw new Error(`Refusing to use database ${mongoose.connection.name}`);
  }
  try {
    return await callback();
  } finally {
    await mongoose.disconnect();
  }
}

describe("phase 3b models and seed", { concurrency: 1 }, () => {
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

  test("requires user fields and hides the password hash", async () => {
    const user = new User({
      name: "Admin One",
      email: "Admin@Baore.com",
      username: "Admin",
      passwordHash: "secret-hash",
      role: "admin",
    });
    await user.validate();
    assert.equal(user.email, "admin@baore.com");
    assert.equal(user.username, "admin");
    assert.equal(user.schema.path("password"), undefined);
    assert.equal(user.schema.path("passwordHash").options.select, false);
    assert.equal(user.toJSON().passwordHash, undefined);

    const missing = new User({ role: "admin" });
    await assert.rejects(missing.validate());
    const badRole = new User({
      name: "A",
      email: "a@baore.com",
      username: "a",
      passwordHash: "hash",
      role: "employee",
    });
    await assert.rejects(badRole.validate(), /employee/);
    const badEmail = new User({
      name: "A",
      email: "not-an-email",
      username: "a",
      passwordHash: "hash",
      role: "user",
    });
    await assert.rejects(badEmail.validate(), /@/);
  });

  test("rejects invalid products and derives stock status", async () => {
    const product = new Product(productInput({ sku: "lip-100", price: 399.5 }));
    await product.validate();
    assert.equal(product.sku, "LIP-100");
    assert.equal(product.stockStatus, "in_stock");
    assert.equal(product.schema.path("status"), undefined);
    assert.equal(product.schema.path("stockStatus"), undefined);
    assert.equal(deriveStockStatus(0), "out_of_stock");
    assert.equal(deriveStockStatus(1), "low_stock");
    assert.equal(deriveStockStatus(5), "low_stock");
    assert.equal(deriveStockStatus(6), "in_stock");

    await assert.rejects(new Product(productInput({ category: "Nails" })).validate(), /category/);
    await assert.rejects(new Product(productInput({ quantity: -1 })).validate(), /quantity/i);
    await assert.rejects(new Product(productInput({ quantity: 1.5 })).validate(), /integer/);
    await assert.rejects(new Product(productInput({ price: -1 })).validate(), /price/i);
    await assert.rejects(new Product(productInput({ price: 10.111 })).validate(), /decimal/);
    await assert.rejects(new Product(productInput({ price: 399.555 })).validate(), /decimal/);
    await new Product(productInput({ quantity: 0, price: 0 })).validate();
    await new Product(productInput({ price: 10.25 })).validate();
  });

  test("rejects invalid stock movements", async () => {
    await new StockMovement(movementInput()).validate();
    await new StockMovement(movementInput({ type: "adjustment", direction: "in", quantityAfter: 8 })).validate();
    await new StockMovement(movementInput({ type: "adjustment", direction: "out" })).validate();
    await new StockMovement(movementInput({ type: "stock_in", quantityBefore: 1, quantityAfter: 3 })).validate();

    await assert.rejects(new StockMovement(movementInput({ type: "transfer" })).validate(), /type/);
    await assert.rejects(new StockMovement(movementInput({ quantity: 0 })).validate(), /quantity/i);
    await assert.rejects(new StockMovement(movementInput({ quantity: -2 })).validate(), /quantity/i);
    await assert.rejects(new StockMovement(movementInput({ quantity: 1.5 })).validate(), /integer/);
    await assert.rejects(new StockMovement(movementInput({ type: "adjustment" })).validate(), /direction/);
    await assert.rejects(new StockMovement(movementInput({ type: "adjustment", direction: "up" })).validate(), /direction/);
    await assert.rejects(new StockMovement(movementInput({ direction: "in" })).validate(), /omitted/);
    await assert.rejects(new StockMovement(movementInput({ quantityBefore: -1 })).validate(), /quantityBefore/);
    await assert.rejects(new StockMovement(movementInput({ quantityAfter: 1.2 })).validate(), /quantityAfter/);
    await assert.rejects(new StockMovement(movementInput({ productName: "  " })).validate(), /productName/);
  });

  test("keeps the admin guard to one identifier", async () => {
    await assert.rejects(new AdminGuard({ _id: "other-guard", revision: 0 }).validate(), /admin-membership/);
    await assert.rejects(new AdminGuard({ _id: ADMIN_GUARD_ID, revision: -1 }).validate(), /revision/i);
    await assert.rejects(new AdminGuard({ _id: ADMIN_GUARD_ID, revision: 1.5 }).validate(), /integer/);
    const guard = new AdminGuard({ revision: 0 });
    await guard.validate();
    assert.equal(String(guard._id), ADMIN_GUARD_ID);
  });

  test("enforces unique indexes and stored field rules", async () => {
    await useTestDb(async () => {
      await mongoose.connection.dropDatabase();
      await Promise.all([
        User.createIndexes(),
        Product.createIndexes(),
        StockMovement.createIndexes(),
        AdminGuard.createIndexes(),
      ]);

      const userIndexes = await mongoose.connection.collection("users").indexes();
      const productIndexes = await mongoose.connection.collection("products").indexes();
      const movementIndexes = await mongoose.connection.collection("stockMovements").indexes();
      assert.ok(userIndexes.some((index) => index.unique && index.key.email === 1));
      assert.ok(userIndexes.some((index) => index.unique && index.key.username === 1));
      assert.ok(productIndexes.some((index) => index.unique && index.key.sku === 1));
      assert.ok(movementIndexes.some((index) => index.key.createdAt === -1 && Object.keys(index.key).length === 1));
      assert.ok(movementIndexes.some((index) => index.key.userId === 1 && index.key.createdAt === -1));
      assert.ok(movementIndexes.some((index) => index.key.productId === 1 && index.key.createdAt === -1));

      await User.create({
        name: "Admin One",
        email: "admin@baore.com",
        username: "admin",
        passwordHash: "hash-one",
        role: "admin",
      });
      await assert.rejects(User.create({
        name: "Other",
        email: "Admin@Baore.com",
        username: "other",
        passwordHash: "hash-two",
        role: "user",
      }));
      await assert.rejects(User.create({
        name: "Other",
        email: "other@baore.com",
        username: "Admin",
        passwordHash: "hash-two",
        role: "user",
      }));

      const storedUser = await User.findOne({ username: "admin" });
      assert.equal(storedUser.passwordHash, undefined);
      const selectedUser = await User.findOne({ username: "admin" }).select("+passwordHash");
      assert.equal(selectedUser.passwordHash, "hash-one");
      assert.equal(selectedUser.toJSON().passwordHash, undefined);

      await Product.create(productInput({ quantity: 4, price: 12.5 }));
      await assert.rejects(Product.create(productInput({ sku: "lip-100", name: "Duplicate" })));
      const storedProduct = await mongoose.connection.collection("products").findOne({ sku: "LIP-100" });
      assert.equal(storedProduct.stockStatus, undefined);
      assert.equal(storedProduct.status, undefined);
      assert.equal(storedProduct.quantity, 4);
      assert.equal(new Product(storedProduct).stockStatus, "low_stock");

      await AdminGuard.create({ _id: ADMIN_GUARD_ID, revision: 0 });
      await assert.rejects(AdminGuard.create({ _id: ADMIN_GUARD_ID, revision: 1 }));
      const guardIndexes = await mongoose.connection.collection("adminGuards").indexes();
      assert.ok(guardIndexes.some((index) => index.name === "_id_" && index.key._id === 1));
    });
  });

  test("connecting does not create collections by itself", async () => {
    await useTestDb(async () => {
      await mongoose.connection.dropDatabase();
      await new Promise((resolve) => setTimeout(resolve, 400));
      const names = (await mongoose.connection.db.listCollections().toArray()).map((collection) => collection.name);
      assert.deepEqual(names, []);
    });
  });

  test("rejects unsafe seed configuration before connecting", async () => {
    assert.throws(() => loadSeedConfig({}), /SEED_ADMIN_PASSWORD/);
    await assert.rejects(() => runSeed({
      MONGODB_URI: "mongodb://127.0.0.1:1/baore_cosmetics_test?replicaSet=rs0",
    }), /SEED_ADMIN_PASSWORD/);
    await assert.rejects(() => runSeed({
      MONGODB_URI: "mongodb://127.0.0.1:1/other_database?replicaSet=rs0",
      SEED_ADMIN_PASSWORD: adminPassword,
      SEED_EMPLOYEE_PASSWORD: employeePassword,
    }), /baore_cosmetics/);
    await assert.rejects(() => runSeed({
      MONGODB_URI: "mongodb://127.0.0.1:1/baore_cosmetics",
      SEED_ADMIN_PASSWORD: adminPassword,
      SEED_EMPLOYEE_PASSWORD: employeePassword,
    }), /replicaSet=rs0/);
    assert.equal(mongoose.connection.readyState, 0);
  });

  test("seeds starter records once and does not reset passwords", async () => {
    await useTestDb(async () => {
      await mongoose.connection.dropDatabase();
    });

    const first = await runSeed(seedEnv);
    assert.deepEqual(first.insertedUsers, ["admin", "employee"]);
    assert.equal(first.insertedProducts.length, 8);
    assert.equal(first.insertedAdminGuard, true);

    let adminHash = "";
    let employeeHash = "";
    await useTestDb(async () => {
      assert.equal(await mongoose.connection.collection("stockMovements").countDocuments(), 0);
      const admin = await User.findOne({ username: "admin" }).select("+passwordHash");
      const employee = await User.findOne({ username: "employee" }).select("+passwordHash");
      adminHash = admin.passwordHash;
      employeeHash = employee.passwordHash;
      assert.equal(await bcrypt.compare(adminPassword, adminHash), true);
      assert.equal(await bcrypt.compare(employeePassword, employeeHash), true);
      assert.notEqual(adminHash, adminPassword);
      assert.equal(admin.toJSON().passwordHash, undefined);
      const lowStock = await Product.findOne({ sku: "CHK-003" });
      assert.equal(lowStock.quantity, 4);
      assert.equal(lowStock.stockStatus, "low_stock");
      const guard = await AdminGuard.findById(ADMIN_GUARD_ID);
      assert.equal(guard.revision, 0);
    });

    const second = await runSeed({
      ...seedEnv,
      SEED_ADMIN_PASSWORD: "replacement-admin-password",
      SEED_EMPLOYEE_PASSWORD: "replacement-employee-password",
    });
    assert.deepEqual(second.insertedUsers, []);
    assert.deepEqual(second.skippedUsers, ["admin", "employee"]);
    assert.deepEqual(second.insertedProducts, []);
    assert.equal(second.skippedProducts.length, 8);
    assert.equal(second.insertedAdminGuard, false);

    await useTestDb(async () => {
      const admin = await User.findOne({ username: "admin" }).select("+passwordHash");
      const employee = await User.findOne({ username: "employee" }).select("+passwordHash");
      assert.equal(admin.passwordHash, adminHash);
      assert.equal(employee.passwordHash, employeeHash);
      assert.equal(await bcrypt.compare(adminPassword, admin.passwordHash), true);
      assert.equal(await bcrypt.compare("replacement-admin-password", admin.passwordHash), false);
      assert.equal(await mongoose.connection.collection("products").countDocuments(), 8);
      assert.equal(await mongoose.connection.collection("users").countDocuments(), 2);
    });
  });

  test("does not overwrite an existing product that differs from the catalogue", async () => {
    await useTestDb(async () => {
      await mongoose.connection.collection("products").updateOne({ sku: "LIP-001" }, { $set: { price: 123.45 } });
    });

    await assert.rejects(() => runSeed(seedEnv), SeedConflictError);

    await useTestDb(async () => {
      const product = await mongoose.connection.collection("products").findOne({ sku: "LIP-001" });
      assert.equal(product.price, 123.45);
      assert.equal(await mongoose.connection.collection("products").countDocuments(), 8);
      const admin = await mongoose.connection.collection("users").findOne({ username: "admin" });
      assert.equal(admin.role, "admin");
    });
  });

  test("leaves an existing non-bcrypt starter account unchanged", async () => {
    await useTestDb(async () => {
      await mongoose.connection.dropDatabase();
      await mongoose.connection.collection("users").insertOne({
        _id: "ObjectId",
        name: "Admin One",
        email: "admin@baore.com",
        username: "admin",
        passwordHash: "hashed_value",
        role: "admin",
        createdAt: "2026-11-20T00:00:00.000Z",
      });
      await mongoose.connection.collection("products").insertOne({
        _id: "ObjectId",
        name: "Velvet Matte Lipstick",
        category: "Lips",
        sku: "LIP-001",
        brand: "Ba'Oré",
        shade: "Rosewood",
        quantity: 28,
        price: 399,
      });
    });

    await assert.rejects(() => runSeed(seedEnv), (error) => {
      assert.ok(error instanceof SeedConflictError);
      assert.match(error.message, /not a bcrypt hash/);
      return true;
    });

    await useTestDb(async () => {
      const user = await mongoose.connection.collection("users").findOne({ username: "admin" });
      assert.equal(user.passwordHash, "hashed_value");
      assert.equal(await mongoose.connection.collection("users").countDocuments(), 1);
      assert.equal(await mongoose.connection.collection("products").countDocuments(), 1);
      assert.equal(await mongoose.connection.collection("adminGuards").countDocuments(), 0);
      const userIndexes = await mongoose.connection.collection("users").indexes();
      assert.deepEqual(userIndexes.map((index) => index.name), ["_id_"]);
    });
  });

  test("stops when a starter username and email belong to different users", async () => {
    await useTestDb(async () => {
      await mongoose.connection.dropDatabase();
      await User.create({
        name: "Taken Name",
        email: "taken@baore.com",
        username: "admin",
        passwordHash: "hash-one",
        role: "admin",
      });
      await User.create({
        name: "Other Name",
        email: "admin@baore.com",
        username: "someone",
        passwordHash: "hash-two",
        role: "user",
      });
    });

    await assert.rejects(() => runSeed(seedEnv), /more than one existing user/);

    await useTestDb(async () => {
      assert.equal(await mongoose.connection.collection("users").countDocuments(), 2);
      assert.equal(await mongoose.connection.collection("products").countDocuments(), 0);
    });
  });

  test("keeps the seed source free of the retired frontend catalogue", () => {
    const root = new URL("../../", import.meta.url);
    assert.equal(fs.existsSync(new URL("src/data/starterData.js", root)), false);
    const seedSource = fs.readFileSync(new URL("../src/seed/seed.js", import.meta.url), "utf8")
      + fs.readFileSync(new URL("../src/seed/catalog.js", import.meta.url), "utf8");
    const serverSource = fs.readFileSync(new URL("../src/server.js", import.meta.url), "utf8");
    assert.equal(seedSource.includes("starterData.js"), false);
    assert.equal(serverSource.includes("seed.js"), false);
    assert.equal(serverSource.includes("models/"), false);
  });
});
