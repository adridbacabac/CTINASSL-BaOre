import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
dotenv.config({ path: path.join(serverRoot, ".env") });

const allowedEnvironments = new Set(["development", "production", "test"]);
const placeholderJwtSecret = "replace-with-a-long-random-secret";
const durationUnits = { s: 1, m: 60, h: 3600, d: 86400 };

export const DEFAULT_BCRYPT_COST = 12;

export const DEFAULT_LOGIN_RATE_LIMIT = {
  windowMs: 15 * 60 * 1000,
  limit: 10,
};

export function jwtSecretProblem(value) {
  if (typeof value !== "string" || value.length < 32) {
    return "JWT_SECRET must be at least 32 characters.";
  }
  if (value === placeholderJwtSecret) {
    return "JWT_SECRET must not use the example placeholder.";
  }
  if (/^(.)\1+$/.test(value)) {
    return "JWT_SECRET must not be a repeated character.";
  }
  return null;
}

export function parseJwtLifetime(value) {
  const match = /^(\d+)(s|m|h|d)$/.exec(value);
  if (!match) return null;
  const amount = Number(match[1]);
  if (!Number.isInteger(amount) || amount < 1 || amount > 365) return null;
  const seconds = amount * durationUnits[match[2]];
  if (seconds < 60 || seconds > 30 * durationUnits.d) return null;
  return seconds;
}

function readUrl(value) {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

export function loadEnv(env = process.env) {
  const errors = [];
  const port = Number(env.PORT);
  const nodeEnv = env.NODE_ENV || "";
  const mongodbUri = env.MONGODB_URI || "";
  const clientOrigin = env.CLIENT_ORIGIN || "";
  const jwtSecret = env.JWT_SECRET || "";
  const jwtExpiresIn = env.JWT_EXPIRES_IN === undefined || env.JWT_EXPIRES_IN === ""
    ? "8h"
    : env.JWT_EXPIRES_IN;

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    errors.push("PORT must be an integer from 1 to 65535.");
  }

  if (!allowedEnvironments.has(nodeEnv)) {
    errors.push("NODE_ENV must be development, production, or test.");
  }

  const databaseUrl = mongodbUri ? readUrl(mongodbUri) : null;
  if (!mongodbUri) {
    errors.push("MONGODB_URI is required.");
  } else if (!databaseUrl) {
    errors.push("MONGODB_URI must be a valid connection URL.");
  } else {
    const databaseName = databaseUrl.pathname.replace(/^\//, "");
    if (databaseName !== "baore_cosmetics") {
      errors.push("MONGODB_URI must select the baore_cosmetics database.");
    }
    if (databaseUrl.searchParams.get("replicaSet") !== "rs0") {
      errors.push("MONGODB_URI must include replicaSet=rs0.");
    }
  }

  if (!clientOrigin) {
    errors.push("CLIENT_ORIGIN is required.");
  } else if (clientOrigin === "*" || !readUrl(clientOrigin)) {
    errors.push("CLIENT_ORIGIN must be a valid URL.");
  }

  const secretProblem = jwtSecretProblem(jwtSecret);
  if (secretProblem) errors.push(secretProblem);

  const jwtExpiresInSeconds = parseJwtLifetime(jwtExpiresIn);
  if (!jwtExpiresInSeconds) {
    errors.push("JWT_EXPIRES_IN must be a duration from 1m to 30d, such as 8h.");
  }

  let bcryptCost = DEFAULT_BCRYPT_COST;
  if (env.BCRYPT_COST !== undefined && String(env.BCRYPT_COST).length > 0) {
    bcryptCost = Number(env.BCRYPT_COST);
    if (!Number.isInteger(bcryptCost) || bcryptCost < 4 || bcryptCost > 31) {
      errors.push("BCRYPT_COST must be an integer from 4 to 31.");
    }
  }

  if (errors.length > 0) {
    throw new Error(`Environment configuration is invalid:\n- ${errors.join("\n- ")}`);
  }

  return {
    port,
    nodeEnv,
    mongodbUri,
    clientOrigin,
    jwtSecret,
    jwtExpiresIn,
    jwtExpiresInSeconds,
    jwtMaxAgeMs: jwtExpiresInSeconds * 1000,
    loginRateLimit: DEFAULT_LOGIN_RATE_LIMIT,
    bcryptCost,
  };
}
