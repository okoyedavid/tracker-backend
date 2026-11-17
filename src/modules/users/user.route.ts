import { Router } from "express";
import { protect, requirePermission, sameOrigin } from "../../middleware/security.module";
import { userController } from "./users.module";
import { roleController } from "../role/role.module";

export const userAdminRouter = Router();
userAdminRouter.use(sameOrigin, protect);
userAdminRouter.post("/", requirePermission("user:create"), userController.createUser);
userAdminRouter.patch("/:userId/role", requirePermission("roles:assign"), roleController.assignRole);
userAdminRouter.patch("/:userId/status", requirePermission("users:manage"), roleController.setUserStatus);
