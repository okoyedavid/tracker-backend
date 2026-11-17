import { randomUUID } from "node:crypto";
import { database } from "../../config/database.module";
import { ApiError } from "../../utils/api-error";
import { tokenService } from "../token/token.module";
import { userRepository } from "../users/users.module";
import { createSessionService } from "./session.service";

export const sessionService = createSessionService({ database,tokenService,userRepository,randomUUID,createApiError: (status,message)=>new ApiError(status,message) });
