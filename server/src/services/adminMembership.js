import mongoose from "mongoose";
import { HttpError } from "../http/errors.js";
import { AdminGuard } from "../models/AdminGuard.js";
import { ADMIN_GUARD_ID } from "../models/constants.js";
import { User } from "../models/User.js";

export const MAX_MEMBERSHIP_ATTEMPTS = 8;
export const LAST_ADMIN_MESSAGE = "Keep at least one administrator account.";
const BUSY_MESSAGE = "Another account change was in progress. Try again.";
const GUARD_MISSING_MESSAGE = "Account changes are unavailable because the administrator guard record is missing.";

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
 * Runs `work(session)` inside one MongoDB transaction that first writes the
 * admin-membership guard. Concurrent membership changes therefore conflict on
 * that document, and only one can commit from a given snapshot. After `work`
 * the admin count is read in the same transaction; zero admins aborts.
 */
export async function runAdminMembershipChange(work, { attempts = MAX_MEMBERSHIP_ATTEMPTS } = {}) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const session = await mongoose.startSession();
    try {
      session.startTransaction({ readConcern: { level: "snapshot" }, writeConcern: { w: "majority" } });
      const guard = await AdminGuard.updateOne(
        { _id: ADMIN_GUARD_ID },
        { $inc: { revision: 1 } },
        { session },
      );
      if (guard.matchedCount !== 1) {
        console.error("Admin guard document admin-membership is missing.");
        throw new HttpError(503, GUARD_MISSING_MESSAGE);
      }
      const result = await work(session);
      const admins = await User.countDocuments({ role: "admin" }, { session });
      if (admins < 1) throw new HttpError(409, LAST_ADMIN_MESSAGE);
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
