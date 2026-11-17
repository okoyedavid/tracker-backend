import { database } from "../../config/database.module";
import { ApiError } from "../../utils/api-error";
import { asyncHandler } from "../../utils/async-handler";
import { userRepository } from "../users/users.module";
import { sessionService } from "../session/session.module";
import { createRoleRepository } from "./role.repository";
import { createRoleService } from "./role.service";
import { createRoleController } from "./role.controller";
import { roleSchemas } from "./role.schema";

const roleRepository = createRoleRepository({ database });
const roleService = createRoleService({
  database,
  roleRepository,
  userRepository,
  sessionService,
  createApiError: (status, message) => new ApiError(status, message),
});
export const roleController = createRoleController({
  roleService,
  schemas: roleSchemas,
  asyncHandler,
});
