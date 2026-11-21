import { ROLES } from "../models/constants.js";
import { HttpError } from "../http/errors.js";

const databaseRoles = new Set(ROLES);

export function requireRole(...allowedRoles) {
  if (allowedRoles.length === 0 || allowedRoles.some((role) => !databaseRoles.has(role))) {
    throw new Error("requireRole must list one or more database roles.");
  }
  const permitted = new Set(allowedRoles);
  return function authorize(req, res, next) {
    if (!req.user) {
      next(new HttpError(401, "Authentication required."));
      return;
    }
    if (!permitted.has(req.user.role)) {
      next(new HttpError(403, "You do not have access to this action."));
      return;
    }
    next();
  };
}

export const requireAdmin = requireRole("admin");
export const requireAdminOrUser = requireRole("admin", "user");
