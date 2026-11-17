import { Router } from "express";
import { protect, requirePermission, sameOrigin } from "../../middleware/security.module";
import { adminController } from "./admin.module";

export const adminRouter = Router();
adminRouter.use(sameOrigin, protect);
adminRouter.get("/users", requirePermission("users:view"), adminController.listUsers);
