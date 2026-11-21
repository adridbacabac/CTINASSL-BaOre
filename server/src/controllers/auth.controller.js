import bcrypt from "bcryptjs";
import { z } from "zod";
import {
  AUTH_COOKIE_NAME,
  authCookieOptions,
  clearAuthCookieOptions,
  publicUser,
  sessionVersionOf,
  signAuthToken,
} from "../auth/session.js";
import { HttpError } from "../http/errors.js";
import { User } from "../models/User.js";

const INVALID_LOGIN = "Invalid username or password.";
const loginBodySchema = z.strictObject({
  username: z.string().trim().min(1).max(80),
  password: z.string().min(1).max(200),
});

// Cost-12 hash used only when no account matches, so that check takes similar time.
const UNKNOWN_USER_HASH = "$2b$12$b/.9ajovUryBmK7bp3wZu.n6rmNjViyADPuOxUHBgZJKEwYCIZJlG";

function parseLoginBody(body) {
  const parsed = loginBodySchema.safeParse(body);
  if (!parsed.success) throw new HttpError(400, "Invalid request.");
  return {
    username: parsed.data.username.toLowerCase(),
    password: parsed.data.password,
  };
}

async function passwordMatches(password, passwordHash) {
  try {
    return await bcrypt.compare(password, passwordHash);
  } catch {
    return false;
  }
}

export function createAuthController(env) {
  return {
    async login(req, res) {
      const { username, password } = parseLoginBody(req.body);
      const user = await User.findOne({ username }).select("+passwordHash");
      const matches = await passwordMatches(password, user?.passwordHash || UNKNOWN_USER_HASH);
      if (!user || !matches) throw new HttpError(401, INVALID_LOGIN);

      res.cookie(AUTH_COOKIE_NAME, signAuthToken(user._id, env, sessionVersionOf(user)), authCookieOptions(env));
      res.json({ user: publicUser(user) });
    },

    logout(req, res) {
      res.clearCookie(AUTH_COOKIE_NAME, clearAuthCookieOptions(env));
      res.json({ message: "Logged out." });
    },

    me(req, res) {
      res.json({ user: req.user });
    },
  };
}
