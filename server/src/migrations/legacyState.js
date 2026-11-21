import mongoose from "mongoose";
import { connectDatabase, disconnectDatabase } from "../config/database.js";
import { Product } from "../models/Product.js";
import { StockMovement } from "../models/StockMovement.js";
import { User } from "../models/User.js";

export const LEGACY_ID = "ObjectId";
export const LEGACY_TIMESTAMP = "2026-11-20T00:00:00.000Z";
export const PLACEHOLDER_PASSWORD_HASH = "hashed_value";
export const APPROVED_QUANTITY_BEFORE = 30;
export const APPROVED_QUANTITY_AFTER = 28;
export const BRAND = String.fromCodePoint(0x42, 0x61, 0x27, 0x4f, 0x72, 0xe9);

const allowedDatabases = new Set(["baore_cosmetics", "baore_cosmetics_test"]);
const expectedCollections = ["products", "stockMovements", "users"];

export const EXPECTED_USER = Object.freeze({
  _id: LEGACY_ID,
  name: "Admin One",
  email: "admin@baore.com",
  username: "admin",
  passwordHash: PLACEHOLDER_PASSWORD_HASH,
  role: "admin",
  createdAt: LEGACY_TIMESTAMP,
});

export const EXPECTED_PRODUCT = Object.freeze({
  _id: LEGACY_ID,
  name: "Velvet Matte Lipstick",
  category: "Lips",
  sku: "LIP-001",
  brand: BRAND,
  shade: "Rosewood",
  quantity: 28,
  price: 399,
});

export const EXPECTED_MOVEMENT = Object.freeze({
  _id: LEGACY_ID,
  productId: LEGACY_ID,
  userId: LEGACY_ID,
  type: "sale",
  quantity: 2,
  note: "Counter sale",
  createdAt: LEGACY_TIMESTAMP,
});

export class LegacyStateError extends Error {
  constructor(message) {
    super(message);
    this.name = "LegacyStateError";
  }
}

function sameKeys(document, keys) {
  return JSON.stringify(Object.keys(document).sort()) === JSON.stringify([...keys].sort());
}

function assertUser(user) {
  if (!sameKeys(user, Object.keys(EXPECTED_USER))) {
    throw new LegacyStateError("Database is not in the expected legacy state.");
  }
  if (user._id !== LEGACY_ID || typeof user._id !== "string") {
    throw new LegacyStateError("Unexpected legacy identifier.");
  }
  const identityMatches = user.name === EXPECTED_USER.name
    && user.email === EXPECTED_USER.email
    && user.username === EXPECTED_USER.username
    && user.role === EXPECTED_USER.role;
  if (!identityMatches) {
    throw new LegacyStateError("Unexpected administrator identity.");
  }
  if (user.passwordHash !== PLACEHOLDER_PASSWORD_HASH) {
    throw new LegacyStateError("Unexpected password hash.");
  }
  if (user.createdAt !== LEGACY_TIMESTAMP || typeof user.createdAt !== "string") {
    throw new LegacyStateError("Database is not in the expected legacy state.");
  }
}

function assertProduct(product) {
  if (!sameKeys(product, Object.keys(EXPECTED_PRODUCT))) {
    throw new LegacyStateError("Database is not in the expected legacy state.");
  }
  if (product._id !== LEGACY_ID || typeof product._id !== "string") {
    throw new LegacyStateError("Unexpected legacy identifier.");
  }
  if (product.quantity !== EXPECTED_PRODUCT.quantity) {
    throw new LegacyStateError("Unexpected product quantity.");
  }
  const catalogueMatches = product.name === EXPECTED_PRODUCT.name
    && product.category === EXPECTED_PRODUCT.category
    && product.sku === EXPECTED_PRODUCT.sku
    && product.brand === EXPECTED_PRODUCT.brand
    && product.shade === EXPECTED_PRODUCT.shade
    && product.price === EXPECTED_PRODUCT.price;
  if (!catalogueMatches) {
    throw new LegacyStateError("Database is not in the expected legacy state.");
  }
}

function assertMovement(movement) {
  if (!sameKeys(movement, Object.keys(EXPECTED_MOVEMENT))) {
    throw new LegacyStateError("Database is not in the expected legacy state.");
  }
  if (movement._id !== LEGACY_ID || typeof movement._id !== "string") {
    throw new LegacyStateError("Unexpected legacy identifier.");
  }
  if (movement.productId !== LEGACY_ID || movement.userId !== LEGACY_ID) {
    throw new LegacyStateError("Incorrect original references.");
  }
  if (movement.type !== EXPECTED_MOVEMENT.type) {
    throw new LegacyStateError("Unexpected movement type.");
  }
  if (movement.quantity !== EXPECTED_MOVEMENT.quantity) {
    throw new LegacyStateError("Unexpected movement quantity.");
  }
  if (movement.note !== EXPECTED_MOVEMENT.note || movement.createdAt !== LEGACY_TIMESTAMP) {
    throw new LegacyStateError("Database is not in the expected legacy state.");
  }
}

export function assertLegacyState(state) {
  const names = [...state.names].sort();
  if (JSON.stringify(names) !== JSON.stringify(expectedCollections)) {
    throw new LegacyStateError("Database is not in the expected legacy state.");
  }
  const duplicateUser = state.users.filter((user) => user.username === EXPECTED_USER.username || user.email === EXPECTED_USER.email).length > 1;
  const duplicateProduct = state.products.filter((product) => product.sku === EXPECTED_PRODUCT.sku).length > 1;
  if (duplicateUser || duplicateProduct) {
    throw new LegacyStateError("Conflicting replacement records already exist.");
  }
  if (state.users.length !== 1 || state.products.length !== 1 || state.movements.length !== 1) {
    throw new LegacyStateError("Database is not in the expected legacy state.");
  }
  assertUser(state.users[0]);
  assertProduct(state.products[0]);
  assertMovement(state.movements[0]);
}

export function buildReplacements(ids = {}) {
  const createdAt = new Date(LEGACY_TIMESTAMP);
  const userId = ids.userId ?? new mongoose.Types.ObjectId();
  const productId = ids.productId ?? new mongoose.Types.ObjectId();
  const movementId = ids.movementId ?? new mongoose.Types.ObjectId();
  return {
    user: {
      _id: userId,
      name: EXPECTED_USER.name,
      email: EXPECTED_USER.email,
      username: EXPECTED_USER.username,
      passwordHash: EXPECTED_USER.passwordHash,
      role: EXPECTED_USER.role,
      createdAt,
    },
    product: {
      _id: productId,
      name: EXPECTED_PRODUCT.name,
      category: EXPECTED_PRODUCT.category,
      sku: EXPECTED_PRODUCT.sku,
      brand: EXPECTED_PRODUCT.brand,
      shade: EXPECTED_PRODUCT.shade,
      quantity: EXPECTED_PRODUCT.quantity,
      price: EXPECTED_PRODUCT.price,
      createdAt,
      updatedAt: createdAt,
    },
    movement: {
      _id: movementId,
      productId,
      userId,
      type: EXPECTED_MOVEMENT.type,
      quantity: EXPECTED_MOVEMENT.quantity,
      note: EXPECTED_MOVEMENT.note,
      quantityBefore: APPROVED_QUANTITY_BEFORE,
      quantityAfter: APPROVED_QUANTITY_AFTER,
      productName: EXPECTED_PRODUCT.name,
      sku: EXPECTED_PRODUCT.sku,
      createdAt,
    },
  };
}

export async function assertReplacementSchemas(replacements) {
  await new User(replacements.user).validate();
  await new Product(replacements.product).validate();
  await new StockMovement(replacements.movement).validate();
  if (replacements.product.quantity !== APPROVED_QUANTITY_AFTER) {
    throw new LegacyStateError("Approved stock snapshots must leave the product quantity at 28.");
  }
  if (replacements.movement.quantityBefore !== APPROVED_QUANTITY_BEFORE
    || replacements.movement.quantityAfter !== APPROVED_QUANTITY_AFTER) {
    throw new LegacyStateError("Approved stock snapshots must be 30 before and 28 after.");
  }
  if (String(replacements.movement.productId) !== String(replacements.product._id)
    || String(replacements.movement.userId) !== String(replacements.user._id)) {
    throw new LegacyStateError("Replacement references do not connect the movement to the new documents.");
  }
  if (replacements.movement.quantity !== 2 || replacements.movement.type !== "sale") {
    throw new LegacyStateError("Replacement movement does not preserve the historical sale.");
  }
}

export function assertMigrationUri(uri) {
  let parsed;
  try {
    parsed = new URL(uri);
  } catch {
    throw new LegacyStateError("MONGODB_URI must be a valid connection URL.");
  }
  const databaseName = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
  if (!allowedDatabases.has(databaseName)) {
    throw new LegacyStateError("MONGODB_URI must select baore_cosmetics or baore_cosmetics_test.");
  }
  if (parsed.searchParams.get("replicaSet") !== "rs0") {
    throw new LegacyStateError("MONGODB_URI must include replicaSet=rs0.");
  }
  return databaseName;
}

export async function assertReplicaSet() {
  const hello = await mongoose.connection.db.admin().command({ hello: 1 });
  if (hello.setName !== "rs0" || hello.isWritablePrimary !== true) {
    throw new LegacyStateError("A writable rs0 replica set member is required.");
  }
}

export async function loadLegacyCollections(db, session) {
  const options = session ? { session } : {};
  const names = (await db.listCollections().toArray()).map((collection) => collection.name).sort();
  const users = await db.collection("users").find({}, options).toArray();
  const products = await db.collection("products").find({}, options).toArray();
  const movements = await db.collection("stockMovements").find({}, options).toArray();
  return { names, users, products, movements };
}

export async function withDatabase(mongodbUri, work) {
  const databaseName = assertMigrationUri(mongodbUri);
  mongoose.set("autoCreate", false);
  mongoose.set("autoIndex", false);
  await connectDatabase(mongodbUri);
  try {
    if (mongoose.connection.name !== databaseName) {
      throw new LegacyStateError("Connected database does not match MONGODB_URI.");
    }
    await assertReplicaSet();
    return await work(mongoose.connection.db);
  } finally {
    await disconnectDatabase();
  }
}
