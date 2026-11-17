import type { asyncHandler as AsyncHandler } from "../../utils/async-handler";
import type { AdminService } from "./admin.service";
import type { adminSchemas } from "./admin.schema";

export const createAdminController = ({ adminService, schemas, asyncHandler }: {
  adminService: AdminService; schemas: typeof adminSchemas; asyncHandler: typeof AsyncHandler;
}) => ({
  listUsers: asyncHandler(async (req, res) => {
    const result = await adminService.listUsers(schemas.listUsers.parse(req.query));
    res.setHeader("Cache-Control", "no-store");
    res.json({ success: true, ...result });
  }),
});
