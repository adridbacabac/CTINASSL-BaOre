import jwt from "jsonwebtoken";
import { HttpError } from "../http/errors.js";

export const AUTH_COOKIE_NAME = "baore_token";
export const TOKEN_ISSUER = "baore-inventory";
export const TOKEN_AUDIENCE = "baore-inventory";

const OBJECT_ID = /^[a-f\d]{24}$/i;

export function authCookieBase(env) {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: env.nodeEnv === "production",
    path: "/",
  };
}

export function authCookieOptions(env) {
  return {
    ...authCookieBase(env),
    maxAge: env.jwtMaxAgeMs,
  };
}

export function clearAuthCookieOptions(env) {
  return {
    ...authCookieBase(env),
    maxAge: 0,
  };
}

export function signAuthToken(userId, env) {
  return jwt.sign({}, env.jwtSecret, {
    algorithm: "HS256",
    subject: String(userId),
    expiresIn: env.jwtExpiresInSeconds,
    issuer: TOKEN_ISSUER,
    audience: TOKEN_AUDIENCE,
  });
}

export function readAuthCookie(req) {
  const header = req.headers.cookie;
  if (!header) return null;
  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator === -1) continue;
    const name = part.slice(0, separator).trim();
    if (name !== AUTH_COOKIE_NAME) continue;
    return decodeURIComponent(part.slice(separator + 1).trim());
  }
  return null;
}

export function verifyAuthToken(token, env) {
  if (!token) throw new HttpError(401, "Authentication required.");
  let payload;
  try {
    payload = jwt.verify(token, env.jwtSecret, {
      algorithms: ["HS256"],
      issuer: TOKEN_ISSUER,
      audience: TOKEN_AUDIENCE,
    });
  } catch {
    throw new HttpError(401, "Authentication required.");
  }
  if (typeof payload.sub !== "string" || !OBJECT_ID.test(payload.sub)) {
    throw new HttpError(401, "Authentication required.");
  }
  return payload.sub;
}

export function publicUser(user) {
  return {
    id: String(user._id),
    name: user.name,
    username: user.username,
    email: user.email,
    role: user.role,
  };
}
