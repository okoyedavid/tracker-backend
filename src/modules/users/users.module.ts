import { database } from "../../config/database.module";
import { createUserRepository } from "./user.repository";
import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { ApiError } from "../../utils/api-error";
import { asyncHandler } from "../../utils/async-handler";
import { emailService } from "../email/email.module";
import { createUserService } from "./user.service";
import { createUserController } from "./user.controller";
import { userSchemas } from "./user.schema";

export const userRepository = createUserRepository({ database });
const createApiError = (status: number, message: string) => new ApiError(status, message);
const userService = createUserService({ database, userRepository, emailService, randomUUID, createApiError,
  hashPassword: password => bcrypt.hash(password, 12) });
export const userController = createUserController({ userService, schemas: userSchemas, asyncHandler, createApiError });
