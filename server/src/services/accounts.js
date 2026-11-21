import bcrypt from "bcryptjs";
import { publicUser } from "../auth/session.js";
import { HttpError } from "../http/errors.js";
import { User } from "../models/User.js";
import { runAdminMembershipChange } from "./adminMembership.js";

const NOT_FOUND = "Account not found.";
const DUPLICATE_USERNAME = "That username is already in use.";
const DUPLICATE_EMAIL = "That email is already in use.";

export function accountProfile(user) {
  return {
    ...publicUser(user),
    createdAt: user.createdAt instanceof Date ? user.createdAt.toISOString() : null,
  };
}

function duplicateKeyError(error) {
  if (error?.code !== 11000) return null;
  const fields = Object.keys(error.keyPattern ?? error.keyValue ?? {});
  if (fields.includes("username")) return new HttpError(409, DUPLICATE_USERNAME);
  if (fields.includes("email")) return new HttpError(409, DUPLICATE_EMAIL);
  return new HttpError(409, "That account conflicts with an existing account.");
}

async function rethrowDuplicate(task) {
  try {
    return await task();
  } catch (error) {
    throw duplicateKeyError(error) ?? error;
  }
}

async function assertActorIsAdmin(actorId, session) {
  const actor = await User.findById(actorId).session(session);
  if (!actor || actor.role !== "admin") {
    throw new HttpError(403, "You do not have access to this action.");
  }
}

async function assertAvailable({ username, email }, exceptId, session) {
  const exclude = exceptId ? { _id: { $ne: exceptId } } : {};
  if (username !== undefined && await User.exists({ ...exclude, username }).session(session)) {
    throw new HttpError(409, DUPLICATE_USERNAME);
  }
  if (email !== undefined && await User.exists({ ...exclude, email }).session(session)) {
    throw new HttpError(409, DUPLICATE_EMAIL);
  }
}

export async function listAccounts() {
  const users = await User.find({}).sort({ createdAt: 1, _id: 1 });
  return users.map(accountProfile);
}

export async function createAccount(input, { actorId, bcryptCost }) {
  const passwordHash = await bcrypt.hash(input.password, bcryptCost);
  return rethrowDuplicate(() => runAdminMembershipChange(async (session) => {
    await assertActorIsAdmin(actorId, session);
    await assertAvailable(input, null, session);
    const [user] = await User.create([{
      name: input.name,
      username: input.username,
      email: input.email,
      role: input.role,
      passwordHash,
    }], { session, ordered: true });
    return accountProfile(user);
  }));
}

export async function updateAccount(id, changes, { actorId }) {
  if (id === actorId && changes.role !== undefined && changes.role !== "admin") {
    throw new HttpError(403, "You cannot remove your own administrator access.");
  }
  return rethrowDuplicate(() => runAdminMembershipChange(async (session) => {
    await assertActorIsAdmin(actorId, session);
    const user = await User.findById(id).session(session);
    if (!user) throw new HttpError(404, NOT_FOUND);
    await assertAvailable(changes, user._id, session);
    user.set(changes);
    await user.save({ session });
    return accountProfile(user);
  }));
}

export async function deleteAccount(id, { actorId }) {
  if (id === actorId) throw new HttpError(403, "You cannot delete your own account.");
  await runAdminMembershipChange(async (session) => {
    await assertActorIsAdmin(actorId, session);
    const result = await User.deleteOne({ _id: id }, { session });
    if (result.deletedCount !== 1) throw new HttpError(404, NOT_FOUND);
  });
}

export async function resetAccountPassword(id, password, { bcryptCost }) {
  const passwordHash = await bcrypt.hash(password, bcryptCost);
  const user = await User.findOneAndUpdate(
    { _id: id },
    { $set: { passwordHash }, $inc: { sessionVersion: 1 } },
    { new: true, runValidators: true },
  );
  if (!user) throw new HttpError(404, NOT_FOUND);
  return user;
}
