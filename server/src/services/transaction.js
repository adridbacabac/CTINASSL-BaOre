import mongoose from "mongoose";
import { HttpError } from "../http/errors.js";

export const MAX_TRANSACTION_ATTEMPTS = 5;
const BUSY_MESSAGE = "The store server was busy with another change. Try again.";

function hasLabel(error, label) {
  return typeof error?.hasErrorLabel === "function" && error.hasErrorLabel(label);
}

function pause(attempt) {
  const delay = 15 * attempt + Math.floor(Math.random() * 25);
  return new Promise((resolve) => setTimeout(resolve, delay));
}

async function commitWithRetry(session) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      await session.commitTransaction();
      return;
    } catch (error) {
      if (hasLabel(error, "UnknownTransactionCommitResult") && attempt < 3) continue;
      throw error;
    }
  }
}

/**
 * Runs `work(session)` in one MongoDB transaction. Every read and write inside
 * `work` must pass `session`. Any error aborts the whole transaction; only a
 * transient transaction error reruns it, and there is no non-transactional fallback.
 */
export async function runTransaction(work, { attempts = MAX_TRANSACTION_ATTEMPTS } = {}) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const session = await mongoose.startSession();
    try {
      session.startTransaction({ readConcern: { level: "snapshot" }, writeConcern: { w: "majority" } });
      const result = await work(session);
      await commitWithRetry(session);
      return result;
    } catch (error) {
      if (session.inTransaction()) {
        await session.abortTransaction().catch(() => {});
      }
      if (hasLabel(error, "TransientTransactionError")) {
        if (attempt < attempts) {
          await pause(attempt);
          continue;
        }
        throw new HttpError(503, BUSY_MESSAGE);
      }
      throw error;
    } finally {
      await session.endSession();
    }
  }
  throw new HttpError(503, BUSY_MESSAGE);
}
