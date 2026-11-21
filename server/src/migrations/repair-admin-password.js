import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import mongoose from "mongoose";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { isBcryptHash } from "../seed/seed.js";
import {
  EXPECTED_USER,
  LEGACY_ID,
  LegacyStateError,
  PLACEHOLDER_PASSWORD_HASH,
  withDatabase,
} from "./legacyState.js";

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function redact(message, secrets) {
  let text = message || "Administrator repair failed.";
  for (const secret of secrets) {
    if (secret) text = text.split(secret).join("[redacted]");
  }
  return text;
}

function readCost(value) {
  if (value === undefined || value === "") return 12;
  const cost = Number(value);
  if (!Number.isInteger(cost) || cost < 4 || cost > 31) {
    throw new LegacyStateError("BCRYPT_COST must be an integer from 4 to 31.");
  }
  return cost;
}

function selectReplacement(users) {
  if (users.some((user) => user._id === LEGACY_ID)) {
    throw new LegacyStateError("The legacy administrator identifier is still present. Migrate the legacy records before repairing the password.");
  }
  const matches = users.filter((user) => user.name === EXPECTED_USER.name
    && user.email === EXPECTED_USER.email
    && user.username === EXPECTED_USER.username
    && user.role === EXPECTED_USER.role);
  if (matches.length !== 1) {
    throw new LegacyStateError("Unexpected administrator identity.");
  }
  const admin = matches[0];
  if (!(admin._id instanceof mongoose.Types.ObjectId)) {
    throw new LegacyStateError("The administrator replacement id is not an ObjectId.");
  }
  if (admin.passwordHash !== PLACEHOLDER_PASSWORD_HASH) {
    if (isBcryptHash(admin.passwordHash)) {
      throw new LegacyStateError("Refusing to replace an existing bcrypt hash.");
    }
    throw new LegacyStateError("Unexpected password hash.");
  }
  return admin;
}

async function executeRepair(db, { password, bcryptCost, afterUpdate }) {
  const session = await mongoose.startSession();
  const secrets = [password];
  try {
    await session.withTransaction(async () => {
      const users = await db.collection("users").find({}, { session }).toArray();
      const admin = selectReplacement(users);
      const passwordHash = await bcrypt.hash(password, bcryptCost);
      secrets.push(passwordHash);
      const verified = await bcrypt.compare(password, passwordHash);
      if (!verified) {
        throw new LegacyStateError("Generated administrator hash failed verification.");
      }
      const result = await db.collection("users").updateOne({
        _id: admin._id,
        name: EXPECTED_USER.name,
        email: EXPECTED_USER.email,
        username: EXPECTED_USER.username,
        role: EXPECTED_USER.role,
        passwordHash: PLACEHOLDER_PASSWORD_HASH,
      }, {
        $set: { passwordHash },
      }, { session });
      if (result.matchedCount !== 1 || result.modifiedCount !== 1) {
        throw new LegacyStateError("Administrator password repair did not update the replacement document.");
      }
      if (afterUpdate) await afterUpdate();
      const updated = await db.collection("users").findOne({ _id: admin._id }, { session });
      const profilePreserved = updated.name === admin.name
        && updated.email === admin.email
        && updated.username === admin.username
        && updated.role === admin.role
        && String(updated._id) === String(admin._id)
        && updated.createdAt.getTime() === admin.createdAt.getTime();
      const hashVerified = await bcrypt.compare(password, updated.passwordHash);
      if (!profilePreserved || !hashVerified || updated.passwordHash === PLACEHOLDER_PASSWORD_HASH) {
        throw new LegacyStateError("Administrator password repair failed verification.");
      }
    });
  } catch (error) {
    throw new LegacyStateError(redact(error.message, secrets));
  } finally {
    await session.endSession();
  }
}

export async function runAdminRepair({ mongodbUri, execute = false, password, bcryptCost = 12, afterUpdate } = {}) {
  if (execute && (typeof password !== "string" || password.length === 0)) {
    throw new LegacyStateError("REPAIR_ADMIN_PASSWORD is required.");
  }
  return withDatabase(mongodbUri, async (db) => {
    const users = await db.collection("users").find({}).toArray();
    const admin = selectReplacement(users);
    if (!execute) {
      return {
        mode: "dry-run",
        databaseName: mongoose.connection.name,
        replicaSet: "rs0",
        writes: 0,
        username: admin.username,
      };
    }
    await executeRepair(db, { password, bcryptCost, afterUpdate });
    return {
      mode: "executed",
      databaseName: mongoose.connection.name,
      replicaSet: "rs0",
      username: admin.username,
    };
  });
}

function printPlan(result) {
  if (result.mode === "dry-run") {
    console.log("Administrator repair dry-run.");
    console.log(`Database: ${result.databaseName}`);
    console.log(`Replica set: ${result.replicaSet}`);
    console.log(`The replacement administrator ${result.username} is ready for repair.`);
    console.log("No password was read and no database writes were performed.");
    return;
  }
  console.log("Administrator password hash replaced and verified.");
}

const isDirectRun = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;

if (isDirectRun) {
  dotenv.config({ path: path.join(serverRoot, ".env") });
  const execute = process.argv.includes("--execute");
  const password = execute ? process.env.REPAIR_ADMIN_PASSWORD : undefined;
  let bcryptCost = 12;
  try {
    bcryptCost = readCost(process.env.BCRYPT_COST);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
  if (process.exitCode !== 1) {
    runAdminRepair({
      mongodbUri: process.env.MONGODB_URI,
      execute,
      password,
      bcryptCost,
    })
      .then(printPlan)
      .catch((error) => {
        console.error(error.message);
        process.exitCode = 1;
      });
  }
}
