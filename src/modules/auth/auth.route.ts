import { Router } from "express";
import { authController } from "./auth.module";
import { protect,sameOrigin,loginLimiter,identityLimiter,emailDeliveryLimiter,otpLimiter } from "../../middleware/security.module";

export const authRouter=Router();
authRouter.use(sameOrigin);
authRouter.get("/me",protect,authController.getMe);
authRouter.post("/login",loginLimiter,identityLimiter,authController.login);
authRouter.get("/google",loginLimiter,authController.google);
authRouter.get("/google/callback",loginLimiter,authController.googleCallback);
authRouter.post("/register",loginLimiter,emailDeliveryLimiter,authController.register);
authRouter.post("/refresh",loginLimiter,authController.refresh);
authRouter.post("/logout",authController.logout);
authRouter.post("/verify-email",otpLimiter,authController.verifyEmail);
authRouter.post("/resend-email",emailDeliveryLimiter,authController.resendEmail);
authRouter.post("/password/forgot",emailDeliveryLimiter,authController.forgotPassword);
authRouter.patch("/password/reset",otpLimiter,authController.resetPassword);
