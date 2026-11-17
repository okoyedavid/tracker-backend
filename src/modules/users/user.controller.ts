import type { asyncHandler as AsyncHandler } from "../../utils/async-handler";
import type { ApiError } from "../../utils/api-error";
import type { UserService } from "./user.service";
import type { userSchemas } from "./user.schema";

export const createUserController = ({ userService, schemas, asyncHandler, createApiError }: {
  userService: UserService; schemas: typeof userSchemas; asyncHandler: typeof AsyncHandler;
  createApiError: (status: number, message: string) => ApiError;
}) => ({
  createUser: asyncHandler(async (req, res) => {
    if (!req.user) throw createApiError(401, "Authentication required.");
    const result = await userService.provisionUser(req.user, schemas.create.parse(req.body));
    res.setHeader("Cache-Control", "no-store");
    res.status(201).json({ message: result.deliveryMethod === "email"
      ? "Worker account created. Login details were emailed to the delivery address."
      : "Worker account created. Copy and share the login details.", data: result.user,
      deliveryEmail: result.deliveryEmail, deliveryMethod: result.deliveryMethod });
  }),
});
