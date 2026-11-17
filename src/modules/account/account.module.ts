import { database } from "../../config/database.module";
import { ApiError } from "../../utils/api-error";
import { asyncHandler } from "../../utils/async-handler";
import { userRepository } from "../users/users.module";
import { authService, hashService, authCookies } from "../auth/auth.module";
import { accountSchemas } from "./account.schema";
import { sessionService } from "../session/session.module";
import { verificationService } from "../verification/verification.module";
import { createAccountService } from "./account.service";
import { createAccountController } from "./account.controller";

const accountService = createAccountService({
  database,
  userRepository,
  authService,
  hashService,
  sessionService,
  verificationService,
  createApiError: (status, message) => new ApiError(status, message),
});
export const accountController = createAccountController({
  accountService,
  schemas: accountSchemas,
  cookies: authCookies,
  asyncHandler,
});
