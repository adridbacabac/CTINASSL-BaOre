import { Router } from "express";
import { productsController } from "../controllers/products.controller.js";
import { asyncHandler } from "../http/errors.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireAdmin, requireAdminOrUser } from "../middleware/requireRole.js";

export function createProductsRouter(env) {
  const router = Router();
  router.use(requireAuth(env));

  router.get("/", requireAdminOrUser, asyncHandler(productsController.list));
  router.get("/:id", requireAdminOrUser, asyncHandler(productsController.get));
  router.post("/", requireAdmin, asyncHandler(productsController.create));
  router.patch("/:id", requireAdmin, asyncHandler(productsController.update));
  router.delete("/:id", requireAdmin, asyncHandler(productsController.remove));

  return router;
}
