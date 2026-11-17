import { Router } from "express";
import {
  protect,
  sameOrigin,
  requirePermission,
} from "../../middleware/security.module";
import { categoryController } from "./category.module";
export const categoryRouter = Router();
categoryRouter.use(sameOrigin, protect);
categoryRouter.get(
  "/",
  requirePermission("categories:view"),
  categoryController.list,
);
categoryRouter.post(
  "/",
  requirePermission("categories:create"),
  categoryController.create,
);
categoryRouter.patch(
  "/:id",
  requirePermission("categories:update"),
  categoryController.update,
);
categoryRouter.delete(
  "/:id",
  requirePermission("categories:delete"),
  categoryController.remove,
);
