import { Router } from "express";
import { movementsController } from "../controllers/movements.controller.js";
import { asyncHandler } from "../http/errors.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireAdmin, requireAdminOrUser } from "../middleware/requireRole.js";

export function createMovementsRouter(env) {
  const router = Router();
  router.use(requireAuth(env));

  router.get("/", requireAdmin, asyncHandler(movementsController.listAll));
  router.get("/mine", requireAdminOrUser, asyncHandler(movementsController.listMine));
  router.post("/", requireAdminOrUser, asyncHandler(movementsController.create));

  return router;
}
