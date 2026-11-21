import { Router } from "express";
import { createUsersController } from "../controllers/users.controller.js";
import { asyncHandler } from "../http/errors.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireAdmin } from "../middleware/requireRole.js";

export function createUsersRouter(env) {
  const router = Router();
  const controller = createUsersController(env);
  router.use(requireAuth(env), requireAdmin);

  router.get("/", asyncHandler(controller.list));
  router.post("/", asyncHandler(controller.create));
  router.patch("/:id", asyncHandler(controller.update));
  router.patch("/:id/password", asyncHandler(controller.resetPassword));
  router.delete("/:id", asyncHandler(controller.remove));

  return router;
}
