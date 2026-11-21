import dotenv from "dotenv";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import mongoose from "mongoose";
import {
  APPROVED_QUANTITY_AFTER,
  APPROVED_QUANTITY_BEFORE,
  EXPECTED_MOVEMENT,
  EXPECTED_PRODUCT,
  EXPECTED_USER,
  LEGACY_ID,
  LegacyStateError,
  assertLegacyState,
  assertReplacementSchemas,
  buildReplacements,
  loadLegacyCollections,
  withDatabase,
} from "./legacyState.js";

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function sameInstant(value, expected) {
  return value instanceof Date && value.getTime() === expected.getTime();
}

async function verifyInserted(db, session, replacements) {
  const options = { session };
  const user = await db.collection("users").findOne({ _id: replacements.user._id }, options);
  const product = await db.collection("products").findOne({ _id: replacements.product._id }, options);
  const movement = await db.collection("stockMovements").findOne({ _id: replacements.movement._id }, options);
  if (!user || !product || !movement) {
    throw new LegacyStateError("Replacement documents were not created.");
  }
  const profilePreserved = user.name === EXPECTED_USER.name
    && user.email === EXPECTED_USER.email
    && user.username === EXPECTED_USER.username
    && user.role === EXPECTED_USER.role
    && user.passwordHash === EXPECTED_USER.passwordHash
  const productPreserved = product.name === EXPECTED_PRODUCT.name
    && product.sku === EXPECTED_PRODUCT.sku
    && product.quantity === EXPECTED_PRODUCT.quantity
    && product.price === EXPECTED_PRODUCT.price
    && product.brand === EXPECTED_PRODUCT.brand
    && product.shade === EXPECTED_PRODUCT.shade
    && product.category === EXPECTED_PRODUCT.category;
  const movementPreserved = movement.type === EXPECTED_MOVEMENT.type
    && movement.quantity === EXPECTED_MOVEMENT.quantity
    && movement.note === EXPECTED_MOVEMENT.note
    && movement.quantityBefore === APPROVED_QUANTITY_BEFORE
    && movement.quantityAfter === APPROVED_QUANTITY_AFTER
    && movement.productName === EXPECTED_PRODUCT.name
    && movement.sku === EXPECTED_PRODUCT.sku
    && String(movement.productId) === String(replacements.product._id)
    && String(movement.userId) === String(replacements.user._id);
  const timestampsPreserved = sameInstant(user.createdAt, replacements.user.createdAt)
    && sameInstant(product.createdAt, replacements.product.createdAt)
    && sameInstant(product.updatedAt, replacements.product.updatedAt)
    && sameInstant(movement.createdAt, replacements.movement.createdAt);
  if (!profilePreserved || !productPreserved || !movementPreserved || !timestampsPreserved) {
    throw new LegacyStateError("Replacement verification failed.");
  }
  const movementCount = await db.collection("stockMovements").countDocuments({}, options);
  if (movementCount !== 2 || product.quantity !== APPROVED_QUANTITY_AFTER) {
    throw new LegacyStateError("Replacement verification failed.");
  }
}

async function deleteLegacy(db, session) {
  const options = { session };
  const userResult = await db.collection("users").deleteOne({ ...EXPECTED_USER }, options);
  const productResult = await db.collection("products").deleteOne({ ...EXPECTED_PRODUCT }, options);
  const movementResult = await db.collection("stockMovements").deleteOne({ ...EXPECTED_MOVEMENT }, options);
  if (userResult.deletedCount !== 1 || productResult.deletedCount !== 1 || movementResult.deletedCount !== 1) {
    throw new LegacyStateError("Legacy documents were not deleted inside the transaction.");
  }
}

async function executeMigration(db, beforeDelete) {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const state = await loadLegacyCollections(db, session);
      assertLegacyState(state);
      const replacements = buildReplacements();
      await assertReplacementSchemas(replacements);
      await db.collection("users").insertOne(replacements.user, { session });
      await db.collection("products").insertOne(replacements.product, { session });
      await db.collection("stockMovements").insertOne(replacements.movement, { session });
      await verifyInserted(db, session, replacements);
      if (beforeDelete) await beforeDelete();
      await deleteLegacy(db, session);
      const legacyRemaining = await db.collection("users").countDocuments({ _id: LEGACY_ID }, { session })
        + await db.collection("products").countDocuments({ _id: LEGACY_ID }, { session })
        + await db.collection("stockMovements").countDocuments({ _id: LEGACY_ID }, { session });
      const userCount = await db.collection("users").countDocuments({}, { session });
      const productCount = await db.collection("products").countDocuments({}, { session });
      const movementCount = await db.collection("stockMovements").countDocuments({}, { session });
      const finalMovement = await db.collection("stockMovements").findOne({ _id: replacements.movement._id }, { session });
      const finalProduct = await db.collection("products").findOne({ _id: replacements.product._id }, { session });
      if (legacyRemaining !== 0 || userCount !== 1 || productCount !== 1 || movementCount !== 1 || !finalMovement || !finalProduct || finalProduct.quantity !== APPROVED_QUANTITY_AFTER || finalMovement.quantityBefore !== APPROVED_QUANTITY_BEFORE || finalMovement.quantityAfter !== APPROVED_QUANTITY_AFTER) {
        throw new LegacyStateError("Replacement verification failed.");
      }
    });
  } finally {
    await session.endSession();
  }
}

export async function runLegacyMigration({ mongodbUri, execute = false, beforeDelete } = {}) {
  return withDatabase(mongodbUri, async (db) => {
    if (!execute) {
      const state = await loadLegacyCollections(db);
      assertLegacyState(state);
      await assertReplacementSchemas(buildReplacements());
      return {
        mode: "dry-run",
        databaseName: mongoose.connection.name,
        replicaSet: "rs0",
        writes: 0,
        changes: [
          "Replace the administrator string id with a new ObjectId, preserving name, email, username, role, placeholder password hash, and the createdAt instant.",
          "Replace the product string id with a new ObjectId, preserving the catalogue and quantity 28. Set createdAt and updatedAt to 2026-11-20T00:00:00.000Z because the product has no timestamp and the other sample records share that instant.",
          "Replace the sale string id with a new ObjectId. Relink productId and userId to the replacement documents. Preserve sale, quantity 2, note, and timestamp. Set quantityBefore 30 and quantityAfter 28.",
        ],
      };
    }
    await executeMigration(db, beforeDelete);
    return {
      mode: "executed",
      databaseName: mongoose.connection.name,
      replicaSet: "rs0",
    };
  });
}

function printPlan(result) {
  console.log(`Legacy migration ${result.mode}`);
  console.log(`Database: ${result.databaseName}`);
  console.log(`Replica set: ${result.replicaSet}`);
  if (result.mode === "dry-run") {
    for (const change of result.changes) console.log(`- ${change}`);
    console.log("No database writes were performed.");
  } else {
    console.log("Legacy migration committed.");
  }
}

const isDirectRun = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;

if (isDirectRun) {
  dotenv.config({ path: path.join(serverRoot, ".env") });
  const execute = process.argv.includes("--execute");
  runLegacyMigration({ mongodbUri: process.env.MONGODB_URI, execute })
    .then(printPlan)
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
}
