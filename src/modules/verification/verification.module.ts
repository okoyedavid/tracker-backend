import { createHmac, randomInt, randomUUID } from "node:crypto";
import { env } from "../../config/env";
import { database } from "../../config/database.module";
import { ApiError } from "../../utils/api-error";
import { emailService } from "../email/email.module";
import { createVerificationService } from "./verification.service";

export const verificationService = createVerificationService({ database,emailService,randomUUID,
  createOtp: ()=>randomInt(100000,1000000).toString(),
  hashOtp: (userId,purpose,otp)=> {
    if (!env.JWT_ACCESS_SECRET) throw new ApiError(503,"JWT_ACCESS_SECRET is not configured.");
    return createHmac("sha256",env.JWT_ACCESS_SECRET).update(`${userId}:${purpose}:${otp}`).digest("hex");
  },createApiError: (status,message)=>new ApiError(status,message) });
