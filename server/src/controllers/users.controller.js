import { z } from "zod";
import { AUTH_COOKIE_NAME, authCookieOptions, sessionVersionOf, signAuthToken } from "../auth/session.js";
import { parseBody, parseObjectId } from "../http/validation.js";
import { ROLES } from "../models/constants.js";
import {
  accountProfile,
  createAccount,
  deleteAccount,
  listAccounts,
  resetAccountPassword,
  updateAccount,
} from "../services/accounts.js";

const USERNAME = /^[a-z0-9._-]{3,40}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const BCRYPT_MAX_BYTES = 72;

const nameSchema = z.string({ error: "Name is required." })
  .trim()
  .min(1, "Name is required.")
  .max(100, "Name must be 100 characters or fewer.");

const usernameSchema = z.string({ error: "Username is required." })
  .trim()
  .toLowerCase()
  .regex(USERNAME, "Username must be 3 to 40 characters: letters, numbers, dots, dashes, or underscores.");

const emailSchema = z.string({ error: "Email is required." })
  .trim()
  .toLowerCase()
  .max(254, "Email must be 254 characters or fewer.")
  .regex(EMAIL, "Enter a valid email address.");

const passwordSchema = z.string({ error: "Password is required." })
  .min(8, "Password must be at least 8 characters.")
  .refine(
    (value) => Buffer.byteLength(value, "utf8") <= BCRYPT_MAX_BYTES,
    "Password must be 72 bytes or fewer.",
  );

const roleSchema = z.enum(ROLES, { error: "Role must be admin or user." });

const createSchema = z.strictObject({
  name: nameSchema,
  username: usernameSchema,
  email: emailSchema,
  password: passwordSchema,
  role: roleSchema,
});

const updateSchema = z.strictObject({
  name: nameSchema.optional(),
  username: usernameSchema.optional(),
  email: emailSchema.optional(),
  role: roleSchema.optional(),
}).refine((value) => Object.keys(value).length > 0, "Send at least one field to update.");

const passwordResetSchema = z.strictObject({ password: passwordSchema });

function accountId(req) {
  return parseObjectId(req.params.id, "Invalid account id.");
}

export function createUsersController(env) {
  return {
    async list(req, res) {
      res.json({ users: await listAccounts() });
    },

    async create(req, res) {
      const input = parseBody(createSchema, req.body);
      const user = await createAccount(input, { actorId: req.user.id, bcryptCost: env.bcryptCost });
      res.status(201).json({ user });
    },

    async update(req, res) {
      const id = accountId(req);
      const changes = parseBody(updateSchema, req.body);
      const user = await updateAccount(id, changes, { actorId: req.user.id });
      res.json({ user });
    },

    async resetPassword(req, res) {
      const id = accountId(req);
      const { password } = parseBody(passwordResetSchema, req.body);
      const user = await resetAccountPassword(id, password, { bcryptCost: env.bcryptCost });
      if (id === req.user.id) {
        res.cookie(AUTH_COOKIE_NAME, signAuthToken(user._id, env, sessionVersionOf(user)), authCookieOptions(env));
      }
      res.json({ user: accountProfile(user), message: "Password updated. Other sessions for this account were signed out." });
    },

    async remove(req, res) {
      const id = accountId(req);
      await deleteAccount(id, { actorId: req.user.id });
      res.json({ message: "Account deleted." });
    },
  };
}
