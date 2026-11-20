import assert from "node:assert/strict";
import fs from "fs";
import mongoose from "mongoose";
import { after, describe, test } from "node:test";
import bcrypt from "bcryptjs";
import { Product } from "../src/models/Product.js";
import { StockMovement } from "../src/models/StockMovement.js";
import { User } from "../src/models/User.js";
import { runLegacyMigration } from "../src/migrations/migrate-legacy-data.js";
import { runAdminRepair } from "../src/migrations/repair-admin-password.js";
import {
  BRAND,
  EXPECTED_MOVEMENT,
  EXPECTED_PRODUCT,
  EXPECTED_USER,
  LEGACY_ID,
  LEGACY_TIMESTAMP,
  assertReplacementSchemas,
  buildReplacements,
} from "../src/migrations/legacyState.js";

const testUri = "mongodb://127.0.0.1:27017/baore_cosmetics_test?replicaSet=rs0";
const repairPassword = "test-only-repair-password";

async function withDb(work) {
  mongoose.set("autoCreate", false);
  mongoose.set("autoIndex", false);
  await mongoose.connect(testUri, { serverSelectionTimeoutMS: 8000, autoCreate: false, autoIndex: false });
  if (mongoose.connection.name !== "baore_cosmetics_test") {
    throw new Error(`Refusing to use database ${mongoose.connection.name}`);
  }
  try {
    return await work(mongoose.connection.db);
  } finally {
    await mongoose.disconnect();
  }
}

async function insertLegacy(overrides = {}) {
  await withDb(async (db) => {
    await db.dropDatabase();
    await db.collection("users").insertOne({ ...EXPECTED_USER, ...overrides.user });
    await db.collection("products").insertOne({ ...EXPECTED_PRODUCT, ...overrides.product });
    await db.collection("stockMovements").insertOne({ ...EXPECTED_MOVEMENT, ...overrides.movement });
    if (overrides.extraProduct) await db.collection("products").insertOne(overrides.extraProduct);
    if (overrides.extraUser) await db.collection("users").insertOne(overrides.extraUser);
  });
}

describe("legacy migration and administrator repair", { concurrency: 1 }, () => {
  after(async () => {
    mongoose.set("autoCreate", false);
    mongoose.set("autoIndex", false);
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(testUri, { serverSelectionTimeoutMS: 8000, autoCreate: false, autoIndex: false });
    }
    if (mongoose.connection.name !== "baore_cosmetics_test") {
      throw new Error(`Refusing to drop database ${mongoose.connection.name}`);
    }
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });

  test("requires the approved 30 to 28 snapshots", async () => {
    assert.deepEqual([...BRAND].map((char) => char.codePointAt(0)), [0x42, 0x61, 0x27, 0x4f, 0x72, 0xe9]);
    const replacements = buildReplacements();
    await assertReplacementSchemas(replacements);
    replacements.movement.quantityAfter = 27;
    await assert.rejects(() => assertReplacementSchemas(replacements), /30 before and 28 after/);
  });

  test("accepts the expected legacy state and refuses to write without the execution flag", async () => {
    await insertLegacy();
    const result = await runLegacyMigration({ mongodbUri: testUri, execute: false });
    assert.equal(result.mode, "dry-run");
    assert.equal(result.writes, 0);
    assert.match(result.changes.join(" "), /quantityBefore 30/);
    assert.match(result.changes.join(" "), /quantityAfter 28/);
    await withDb(async (db) => {
      assert.equal(await db.collection("users").countDocuments(), 1);
      assert.equal((await db.collection("users").findOne())._id, LEGACY_ID);
      assert.equal(await db.collection("products").countDocuments(), 1);
      assert.equal(await db.collection("stockMovements").countDocuments(), 1);
    });
  });

  test("rejects an unexpected administrator, hash, quantity, movement, or reference", async () => {
    await insertLegacy({ user: { name: "Other Admin" } });
    await assert.rejects(() => runLegacyMigration({ mongodbUri: testUri, execute: true }), /administrator identity/);

    await insertLegacy({ user: { passwordHash: "$2b$12$already-a-different-value" } });
    await assert.rejects(() => runLegacyMigration({ mongodbUri: testUri, execute: true }), /password hash/);

    await insertLegacy({ product: { quantity: 27 } });
    await assert.rejects(() => runLegacyMigration({ mongodbUri: testUri, execute: true }), /product quantity/);

    await insertLegacy({ movement: { quantity: 3 } });
    await assert.rejects(() => runLegacyMigration({ mongodbUri: testUri, execute: true }), /movement quantity/);

    await insertLegacy({ movement: { type: "restock" } });
    await assert.rejects(() => runLegacyMigration({ mongodbUri: testUri, execute: true }), /movement type/);

    await insertLegacy({ movement: { productId: "other-product" } });
    await assert.rejects(() => runLegacyMigration({ mongodbUri: testUri, execute: true }), /original references/);

    await withDb(async (db) => {
      assert.equal(await db.collection("users").countDocuments({ _id: LEGACY_ID }), 1);
      assert.equal(await db.collection("products").countDocuments(), 1);
      assert.equal((await db.collection("products").findOne()).quantity, 28);
      assert.equal(await db.collection("stockMovements").countDocuments(), 1);
    });
  });

  test("rejects conflicting replacement records before writing", async () => {
    await insertLegacy({
      extraProduct: {
        ...EXPECTED_PRODUCT,
        _id: new mongoose.Types.ObjectId(),
        name: "Duplicate Lipstick",
      },
    });
    await assert.rejects(() => runLegacyMigration({ mongodbUri: testUri, execute: true }), /Conflicting replacement/);
    await withDb(async (db) => {
      assert.equal(await db.collection("products").countDocuments(), 2);
      assert.equal(await db.collection("products").countDocuments({ _id: LEGACY_ID }), 1);
    });
  });

  test("rolls back the transaction when a later step fails", async () => {
    await insertLegacy();
    await assert.rejects(() => runLegacyMigration({
      mongodbUri: testUri,
      execute: true,
      beforeDelete() {
        throw new Error("forced abort");
      },
    }), /forced abort/);
    await withDb(async (db) => {
      const users = await db.collection("users").find().toArray();
      const products = await db.collection("products").find().toArray();
      const movements = await db.collection("stockMovements").find().toArray();
      assert.equal(users.length, 1);
      assert.equal(users[0]._id, LEGACY_ID);
      assert.equal(users[0].passwordHash, EXPECTED_USER.passwordHash);
      assert.equal(products.length, 1);
      assert.equal(products[0].quantity, 28);
      assert.equal(movements.length, 1);
      assert.equal(movements[0].quantityBefore, undefined);
    });
  });

  test("migrates the three legacy documents and preserves the approved sale", async () => {
    await insertLegacy();
    const result = await runLegacyMigration({ mongodbUri: testUri, execute: true });
    assert.equal(result.mode, "executed");
    await withDb(async (db) => {
      const users = await db.collection("users").find().toArray();
      const products = await db.collection("products").find().toArray();
      const movements = await db.collection("stockMovements").find().toArray();
      assert.equal(users.length, 1);
      assert.ok(users[0]._id instanceof mongoose.Types.ObjectId);
      assert.equal(users[0].name, "Admin One");
      assert.equal(users[0].email, "admin@baore.com");
      assert.equal(users[0].username, "admin");
      assert.equal(users[0].role, "admin");
      assert.equal(users[0].passwordHash, EXPECTED_USER.passwordHash);
      assert.equal(users[0].createdAt.toISOString(), LEGACY_TIMESTAMP);
      assert.equal(products.length, 1);
      assert.equal(products[0].sku, "LIP-001");
      assert.equal(products[0].quantity, 28);
      assert.equal(products[0].price, 399);
      assert.equal(products[0].createdAt.toISOString(), LEGACY_TIMESTAMP);
      assert.equal(products[0].updatedAt.toISOString(), LEGACY_TIMESTAMP);
      assert.equal(movements.length, 1);
      assert.equal(movements[0].type, "sale");
      assert.equal(movements[0].quantity, 2);
      assert.equal(movements[0].note, "Counter sale");
      assert.equal(movements[0].quantityBefore, 30);
      assert.equal(movements[0].quantityAfter, 28);
      assert.equal(movements[0].productName, "Velvet Matte Lipstick");
      assert.equal(movements[0].sku, "LIP-001");
      assert.equal(movements[0].createdAt.toISOString(), LEGACY_TIMESTAMP);
      assert.equal(String(movements[0].productId), String(products[0]._id));
      assert.equal(String(movements[0].userId), String(users[0]._id));
      const populated = await StockMovement.findOne().populate("productId").populate("userId");
      assert.equal(populated.productId.sku, "LIP-001");
      assert.equal(populated.userId.username, "admin");
      assert.equal(populated.quantityBefore, 30);
      assert.equal(populated.quantityAfter, 28);
      assert.equal((await Product.findOne()).quantity, 28);
      const selected = await User.findOne().select("+passwordHash");
      assert.equal(selected.passwordHash, EXPECTED_USER.passwordHash);
      assert.equal(selected.toJSON().passwordHash, undefined);
    });
  });

  test("repairs only the migrated administrator and leaves the profile unchanged", async () => {
    await insertLegacy();
    await assert.rejects(() => runAdminRepair({
      mongodbUri: testUri,
      execute: true,
      password: repairPassword,
      bcryptCost: 4,
    }), /legacy administrator identifier/);

    await runLegacyMigration({ mongodbUri: testUri, execute: true });
    const preview = await runAdminRepair({ mongodbUri: testUri, execute: false, password: repairPassword });
    assert.equal(preview.mode, "dry-run");
    assert.equal(preview.writes, 0);
    await withDb(async (db) => {
      assert.equal((await db.collection("users").findOne()).passwordHash, EXPECTED_USER.passwordHash);
    });

    await assert.rejects(() => runAdminRepair({ mongodbUri: testUri, execute: true, bcryptCost: 4 }), /REPAIR_ADMIN_PASSWORD/);

    const repaired = await runAdminRepair({
      mongodbUri: testUri,
      execute: true,
      password: repairPassword,
      bcryptCost: 4,
    });
    assert.equal(repaired.mode, "executed");
    await withDb(async (db) => {
      const user = await db.collection("users").findOne();
      assert.equal(await bcrypt.compare(repairPassword, user.passwordHash), true);
      assert.notEqual(user.passwordHash, repairPassword);
      assert.equal(user.name, "Admin One");
      assert.equal(user.email, "admin@baore.com");
      assert.equal(user.username, "admin");
      assert.equal(user.role, "admin");
      assert.equal(user.createdAt.toISOString(), LEGACY_TIMESTAMP);
      assert.ok(user._id instanceof mongoose.Types.ObjectId);
      assert.equal((await db.collection("products").findOne()).quantity, 28);
      assert.equal(await db.collection("stockMovements").countDocuments(), 1);
    });

    await assert.rejects(() => runAdminRepair({
      mongodbUri: testUri,
      execute: true,
      password: "another-test-password",
      bcryptCost: 4,
    }), /existing bcrypt hash/);
  });

  test("rolls back a failed password repair", async () => {
    await insertLegacy();
    await runLegacyMigration({ mongodbUri: testUri, execute: true });
    await assert.rejects(() => runAdminRepair({
      mongodbUri: testUri,
      execute: true,
      password: repairPassword,
      bcryptCost: 4,
      afterUpdate() {
        throw new Error("forced repair abort");
      },
    }), /forced repair abort/);
    await withDb(async (db) => {
      assert.equal((await db.collection("users").findOne()).passwordHash, EXPECTED_USER.passwordHash);
    });
  });

  test("keeps migration and repair commands separate from startup and seeding", () => {
    const server = fs.readFileSync(new URL("../src/server.js", import.meta.url), "utf8");
    const seed = fs.readFileSync(new URL("../src/seed/seed.js", import.meta.url), "utf8");
    const migration = fs.readFileSync(new URL("../src/migrations/migrate-legacy-data.js", import.meta.url), "utf8");
    const repair = fs.readFileSync(new URL("../src/migrations/repair-admin-password.js", import.meta.url), "utf8");
    assert.equal(server.includes("migrate-legacy-data"), false);
    assert.equal(server.includes("repair-admin-password"), false);
    assert.equal(seed.includes("migrate-legacy-data"), false);
    assert.equal(seed.includes("repair-admin-password"), false);
    assert.equal(migration.includes("REPAIR_ADMIN_PASSWORD"), false);
    assert.equal(repair.includes("SEED_ADMIN_PASSWORD"), false);
    assert.equal(repair.includes("SEED_EMPLOYEE_PASSWORD"), false);
  });
});
