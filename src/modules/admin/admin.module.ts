import { database } from "../../config/database.module";
import { asyncHandler } from "../../utils/async-handler";
import { adminSchemas } from "./admin.schema";
import { createAdminRepository } from "./admin.repository";
import { createAdminService } from "./admin.service";
import { createAdminController } from "./admin.controller";

const adminRepository = createAdminRepository({ database });
const adminService = createAdminService({ adminRepository });
export const adminController = createAdminController({ adminService, schemas: adminSchemas, asyncHandler });
