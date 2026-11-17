import { Router } from "express";
import { accountController } from "./account.module";
import {
  protect,
  sameOrigin,
  emailDeliveryLimiter,
  otpLimiter,
} from "../../middleware/security.module";

export const accountRouter = Router();
accountRouter.use(sameOrigin, protect);
accountRouter.patch("/me", accountController.updateProfile);
accountRouter.patch("/me/avatar", accountController.updateAvatar);
accountRouter.delete("/me/avatar", accountController.deleteAvatar);
accountRouter.patch(
  "/me/password",
  otpLimiter,
  accountController.changePassword,
);
accountRouter.post(
  "/me/email/change",
  emailDeliveryLimiter,
  accountController.requestEmailChange,
);
accountRouter.patch(
  "/me/email/change",
  otpLimiter,
  accountController.verifyEmailChange,
);
