import { User } from "../models/User.js";
import { asyncHandler, HttpError } from "../http/errors.js";
import { publicUser, readAuthCookie, sessionVersionOf, verifyAuthToken } from "../auth/session.js";

export function requireAuth(env) {
  return asyncHandler(async (req, res, next) => {
    const { userId, sessionVersion } = verifyAuthToken(readAuthCookie(req), env);
    const user = await User.findById(userId);
    if (!user || sessionVersionOf(user) !== sessionVersion) {
      throw new HttpError(401, "Authentication required.");
    }
    req.user = publicUser(user);
    next();
  });
}
