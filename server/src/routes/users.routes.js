import { Router } from "express";
import { z } from "zod";
import { AUTH_COOKIE_NAME, authCookieOptions, sessionVersionOf, signAuthToken } from "../auth/session.js";
import { asyncHandler, HttpError } from "../http/errors.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireAdmin } from "../middleware/requireRole.js";
import { ROLES } from "../models/constants.js";
import {
  accountProfile,
  createAccount,
  deleteAccount,
  listAccounts,
  resetAccountPassword,
  updateAccount,
} from "../services/accounts.js";

const OBJECT_ID = /^[a-f\d]{24}$/i;
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

function parseBody(schema, body) {
  const parsed = schema.safeParse(body ?? {});
  if (parsed.success) return parsed.data;
  const issue = parsed.error.issues[0];
  if (issue.code === "unrecognized_keys" || issue.path.length === 0 && issue.code === "invalid_type") {
    throw new HttpError(400, "Invalid request.");
  }
  throw new HttpError(400, issue.message);
}

function accountId(req) {
  const { id } = req.params;
  if (!OBJECT_ID.test(id)) throw new HttpError(400, "Invalid account id.");
  return id.toLowerCase();
}

export function createUsersRouter(env) {
  const router = Router();
  router.use(requireAuth(env), requireAdmin);

  router.get("/", asyncHandler(async (req, res) => {
    res.json({ users: await listAccounts() });
  }));

  router.post("/", asyncHandler(async (req, res) => {
    const input = parseBody(createSchema, req.body);
    const user = await createAccount(input, { actorId: req.user.id, bcryptCost: env.bcryptCost });
    res.status(201).json({ user });
  }));

  router.patch("/:id", asyncHandler(async (req, res) => {
    const id = accountId(req);
    const changes = parseBody(updateSchema, req.body);
    const user = await updateAccount(id, changes, { actorId: req.user.id });
    res.json({ user });
  }));

  router.patch("/:id/password", asyncHandler(async (req, res) => {
    const id = accountId(req);
    const { password } = parseBody(passwordResetSchema, req.body);
    const user = await resetAccountPassword(id, password, { bcryptCost: env.bcryptCost });
    if (id === req.user.id) {
      res.cookie(AUTH_COOKIE_NAME, signAuthToken(user._id, env, sessionVersionOf(user)), authCookieOptions(env));
    }
    res.json({ user: accountProfile(user), message: "Password updated. Other sessions for this account were signed out." });
  }));

  router.delete("/:id", asyncHandler(async (req, res) => {
    const id = accountId(req);
    await deleteAccount(id, { actorId: req.user.id });
    res.json({ message: "Account deleted." });
  }));

  return router;
}
