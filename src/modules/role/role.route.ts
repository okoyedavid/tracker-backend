import { Router } from "express";
import {
  protect,
  requirePermission,
  sameOrigin,
} from "../../middleware/security.module";
import { roleController } from "./role.module";

export const roleRouter = Router();
roleRouter.use(sameOrigin, protect);
roleRouter.get("/", requirePermission("roles:view"), roleController.listRoles);
roleRouter.post(
  "/",
  requirePermission("roles:manage"),
  roleController.createRole,
);
roleRouter.patch(
  "/:roleId",
  requirePermission("roles:manage"),
  roleController.updateRole,
);
roleRouter.delete(
  "/:roleId",
  requirePermission("roles:manage"),
  roleController.archiveRole,
);
