import rateLimit from "express-rate-limit";
import { Router } from "express";
import { createAuthController } from "../controllers/auth.controller.js";
import { asyncHandler } from "../http/errors.js";
import { requireAuth } from "../middleware/requireAuth.js";

export function createAuthRouter(env) {
  const router = Router();
  const controller = createAuthController(env);
  const loginRateLimit = env.loginRateLimit ?? { windowMs: 15 * 60 * 1000, limit: 10 };
  const limiter = rateLimit({
    windowMs: loginRateLimit.windowMs,
    limit: loginRateLimit.limit,
    standardHeaders: true,
    legacyHeaders: false,
    statusCode: 429,
    message: { error: "Too many login attempts." },
    handler(req, res) {
      res.status(429).json({ error: "Too many login attempts." });
    },
  });

  router.post("/login", limiter, asyncHandler(controller.login));
  router.post("/logout", controller.logout);
  router.get("/me", requireAuth(env), controller.me);

  return router;
}
