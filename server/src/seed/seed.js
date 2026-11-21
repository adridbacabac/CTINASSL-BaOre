import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import mongoose from "mongoose";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { connectDatabase, disconnectDatabase } from "../config/database.js";
import { ADMIN_GUARD_ID } from "../models/constants.js";
import { AdminGuard, Product, StockMovement, User } from "../models/index.js";
import { starterAccounts, starterProducts } from "./catalog.js";

mongoose.set("autoCreate", false);
mongoose.set("autoIndex", false);

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const allowedDatabases = new Set(["baore_cosmetics", "baore_cosmetics_test"]);
const productFields = ["name", "category", "sku", "brand", "shade", "quantity", "price"];

export class SeedConflictError extends Error {
  constructor(conflicts) {
    super(`Seed stopped before changing the database:\n- ${conflicts.join("\n- ")}`);
    this.name = "SeedConflictError";
    this.conflicts = conflicts;
  }
}

function readUrl(value) {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function normalizeEmail(value) {
  return String(value ?? "").trim().toLowerCase();
}

function normalizeUsername(value) {
  return String(value ?? "").trim().toLowerCase();
}

function normalizeSku(value) {
  return String(value ?? "").trim().toUpperCase();
}

export function isBcryptHash(value) {
  return typeof value === "string" && /^\$2[aby]\$\d{2}\$/.test(value);
}

export function loadSeedConfig(env = process.env) {
  const errors = [];
  const mongodbUri = env.MONGODB_URI || "";
  const adminPassword = env.SEED_ADMIN_PASSWORD;
  const employeePassword = env.SEED_EMPLOYEE_PASSWORD;

  if (!mongodbUri) {
    errors.push("MONGODB_URI is required.");
  } else {
    const databaseUrl = readUrl(mongodbUri);
    if (!databaseUrl) {
      errors.push("MONGODB_URI must be a valid connection URL.");
    } else {
      const databaseName = databaseUrl.pathname.replace(/^\//, "");
      if (!allowedDatabases.has(databaseName)) {
        errors.push("MONGODB_URI must select baore_cosmetics or baore_cosmetics_test.");
      }
      if (databaseUrl.searchParams.get("replicaSet") !== "rs0") {
        errors.push("MONGODB_URI must include replicaSet=rs0.");
      }
    }
  }

  if (typeof adminPassword !== "string" || adminPassword.length === 0) {
    errors.push("SEED_ADMIN_PASSWORD is required.");
  }
  if (typeof employeePassword !== "string" || employeePassword.length === 0) {
    errors.push("SEED_EMPLOYEE_PASSWORD is required.");
  }

  let bcryptCost = 12;
  if (env.BCRYPT_COST !== undefined && String(env.BCRYPT_COST).length > 0) {
    bcryptCost = Number(env.BCRYPT_COST);
    if (!Number.isInteger(bcryptCost) || bcryptCost < 4 || bcryptCost > 31) {
      errors.push("BCRYPT_COST must be an integer from 4 to 31.");
    }
  }

  if (errors.length > 0) {
    throw new Error(`Seed configuration is invalid:\n- ${errors.join("\n- ")}`);
  }

  return { mongodbUri, adminPassword, employeePassword, bcryptCost };
}

function sameProduct(existing, starter) {
  return productFields.every((field) => {
    if (field === "sku") return normalizeSku(existing.sku) === starter.sku;
    if (field === "quantity" || field === "price") return Number(existing[field]) === starter[field];
    return String(existing[field] ?? "").trim() === starter[field];
  });
}

function accountPassword(account, config) {
  return account.passwordEnv === "SEED_ADMIN_PASSWORD" ? config.adminPassword : config.employeePassword;
}

export async function buildSeedPlan() {
  const users = await mongoose.connection.collection("users").find({}).toArray();
  const products = await mongoose.connection.collection("products").find({}).toArray();
  const guards = await mongoose.connection.collection("adminGuards").find({}).toArray();
  const conflicts = [];
  const userInserts = [];
  const skippedUsers = [];

  for (const account of starterAccounts) {
    const email = normalizeEmail(account.email);
    const username = normalizeUsername(account.username);
    const matches = new Map();
    for (const user of users) {
      if (normalizeUsername(user.username) === username || normalizeEmail(user.email) === email) {
        matches.set(String(user._id), user);
      }
    }
    const found = [...matches.values()];
    if (found.length > 1) {
      conflicts.push(`Starter account ${username} matches more than one existing user. No records were changed.`);
      continue;
    }
    if (found.length === 0) {
      userInserts.push(account);
      continue;
    }

    const existing = found[0];
    const sameIdentity = normalizeUsername(existing.username) === username
      && normalizeEmail(existing.email) === email
      && String(existing.name ?? "").trim() === account.name
      && existing.role === account.role;
    if (!sameIdentity) {
      conflicts.push(`Starter account ${username} conflicts with an existing user. The existing record was not modified.`);
      continue;
    }
    if (!isBcryptHash(existing.passwordHash)) {
      conflicts.push(`Starter account ${username} already exists, but its passwordHash is not a bcrypt hash. The existing record was not modified.`);
      continue;
    }
    skippedUsers.push(username);
  }

  const productInserts = [];
  const skippedProducts = [];
  for (const starter of starterProducts) {
    const matches = products.filter((product) => normalizeSku(product.sku) === starter.sku);
    if (matches.length > 1) {
      conflicts.push(`Starter product ${starter.sku} matches more than one existing product. No records were changed.`);
      continue;
    }
    if (matches.length === 0) {
      productInserts.push(starter);
      continue;
    }
    if (!sameProduct(matches[0], starter)) {
      conflicts.push(`Starter product ${starter.sku} differs from the existing product. The existing record was not modified.`);
      continue;
    }
    skippedProducts.push(starter.sku);
  }

  let guardAction = "insert";
  if (guards.length > 1) {
    guardAction = "conflict";
    conflicts.push("More than one admin guard document exists. No records were changed.");
  } else if (guards.length === 1) {
    const guard = guards[0];
    if (String(guard._id) !== ADMIN_GUARD_ID || !Number.isInteger(guard.revision) || guard.revision < 0) {
      guardAction = "conflict";
      conflicts.push("The existing admin guard document is not the expected singleton. It was not modified.");
    } else {
      guardAction = "skip";
    }
  }

  return {
    conflicts,
    userInserts,
    skippedUsers,
    productInserts,
    skippedProducts,
    guardAction,
  };
}

async function applySeedPlan(plan, config) {
  await Promise.all([
    User.createIndexes(),
    Product.createIndexes(),
    StockMovement.createIndexes(),
    AdminGuard.createIndexes(),
  ]);

  const passwords = plan.userInserts.map((account) => accountPassword(account, config));
  const passwordHashes = [];
  for (const password of passwords) {
    passwordHashes.push(await bcrypt.hash(password, config.bcryptCost));
  }

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      if (plan.userInserts.length > 0) {
        await User.create(plan.userInserts.map((account, index) => ({
          name: account.name,
          email: account.email,
          username: account.username,
          passwordHash: passwordHashes[index],
          role: account.role,
        })), { session, ordered: true });
      }
      if (plan.productInserts.length > 0) {
        await Product.create(plan.productInserts, { session, ordered: true });
      }
      if (plan.guardAction === "insert") {
        await AdminGuard.create([{ _id: ADMIN_GUARD_ID, revision: 0 }], { session, ordered: true });
      }
    });
  } catch (error) {
    const secretValues = [config.adminPassword, config.employeePassword, ...passwordHashes];
    let message = error.message || "Seed insert failed.";
    for (const secret of secretValues) {
      if (secret) message = message.split(secret).join("[redacted]");
    }
    throw new Error(`Seed insert failed and existing records were not deleted. ${message}`);
  } finally {
    await session.endSession();
  }

  return {
    insertedUsers: plan.userInserts.map((account) => account.username),
    skippedUsers: plan.skippedUsers,
    insertedProducts: plan.productInserts.map((product) => product.sku),
    skippedProducts: plan.skippedProducts,
    insertedAdminGuard: plan.guardAction === "insert",
  };
}

export async function runSeed(env = process.env) {
  const config = loadSeedConfig(env);
  await connectDatabase(config.mongodbUri);
  try {
    const plan = await buildSeedPlan();
    if (plan.conflicts.length > 0) {
      throw new SeedConflictError(plan.conflicts);
    }
    return await applySeedPlan(plan, config);
  } finally {
    await disconnectDatabase();
  }
}

function printSummary(summary) {
  console.log(`Inserted users: ${summary.insertedUsers.join(", ") || "none"}`);
  console.log(`Skipped users: ${summary.skippedUsers.join(", ") || "none"}`);
  console.log(`Inserted products: ${summary.insertedProducts.join(", ") || "none"}`);
  console.log(`Skipped products: ${summary.skippedProducts.join(", ") || "none"}`);
  console.log(`Admin guard: ${summary.insertedAdminGuard ? "inserted" : "already present"}`);
}

const isDirectRun = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;

if (isDirectRun) {
  dotenv.config({ path: path.join(serverRoot, ".env") });
  runSeed()
    .then(printSummary)
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
}
