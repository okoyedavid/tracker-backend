import type { Request } from "express";
import type { asyncHandler as AsyncHandler } from "../../utils/async-handler";
import type { ApiError } from "../../utils/api-error";
import type { AuthCookies } from "../../utils/cookie";
import type { AuthService } from "./auth.service";
import type { SessionService } from "../session/session.service";
import type { GoogleOAuthService } from "./google-oauth.adapter";
import type { authSchemas } from "./auth.schema";

export const createAuthController = ({
  authService,
  sessionService,
  googleOAuthService,
  cookies,
  schemas,
  asyncHandler,
  clientUrl,
  createApiError,
}: {
  authService: AuthService;
  sessionService: SessionService;
  googleOAuthService: GoogleOAuthService;
  cookies: AuthCookies;
  schemas: typeof authSchemas;
  asyncHandler: typeof AsyncHandler;
  clientUrl: string;
  createApiError: (status: number, message: string) => ApiError;
}) => {
  const metadata = (req: Request) => ({
    userAgent: req.get("user-agent")?.slice(0, 512) ?? null,
    ipAddress: req.ip ?? null,
  });
  const login = asyncHandler(async (req, res) => {
    const result = await authService.loginUser({
      ...schemas.login.parse(req.body),
      requestMetadata: metadata(req),
    });
    cookies.setAuthCookies(res, result);
    res.json({ message: "Login successful", user: result.user });
  });
  const register = asyncHandler(async (req, res) => {
    const result = await authService.registerUser(
      schemas.register.parse(req.body),
    );
    res.status(201).json({
      message: "User registered successfully. Check your email for the OTP.",
      user: result.user,
    });
  });
  const getMe = asyncHandler(async (req, res) => {
    if (!req.user) throw createApiError(401, "Authentication required.");
    const user = await authService.getCurrentUser(req.user.id);
    res.json({
      data: user,
      message: "User successfully retrieved",
      success: true,
    });
  });
  const refresh = asyncHandler(async (req, res) => {
    const token = req.cookies?.refreshToken;
    if (typeof token !== "string")
      throw createApiError(401, "Refresh token is required.");
    const result = await sessionService.refreshUserSession(token);
    cookies.setAuthCookies(res, result);
    res.json({
      message: "Session refreshed successfully",
      userSession: result.userSession,
    });
  });
  const logout = asyncHandler(async (req, res) => {
    try {
      await sessionService.logoutUser(
        typeof req.cookies?.refreshToken === "string"
          ? req.cookies.refreshToken
          : undefined,
      );
    } finally {
      cookies.clearAuthCookies(res);
    }
    res.json({ message: "Logout successful" });
  });
  const verifyEmail = asyncHandler(async (req, res) => {
    const user = await authService.verifyEmail(schemas.verify.parse(req.body));
    res.json({ message: "Email verified successfully", user });
  });
  const resendEmail = asyncHandler(async (req, res) => {
    await authService.requestCode(
      schemas.email.parse(req.body).email,
      "verify_email",
    );
    res.json({
      message: "If the account needs verification, a code has been sent.",
    });
  });
  const forgotPassword = asyncHandler(async (req, res) => {
    await authService.requestCode(
      schemas.email.parse(req.body).email,
      "reset_password",
    );
    res.json({
      message: "If the account exists, a password-reset code has been sent.",
    });
  });
  const resetPassword = asyncHandler(async (req, res) => {
    await authService.resetPassword(schemas.reset.parse(req.body));
    cookies.clearAuthCookies(res);
    res.json({ message: "Password reset successfully. Please log in again." });
  });
  const google = asyncHandler(async (_req, res) => {
    const state = googleOAuthService.createState();
    const url = googleOAuthService.getAuthorizationUrl(state);
    cookies.setOAuthStateCookie(res, state);
    res.redirect(url);
  });
  const googleCallback = asyncHandler(async (req, res) => {
    const query = schemas.callback.parse(req.query);
    const stored = req.cookies?.googleOAuthState;
    cookies.clearOAuthStateCookie(res);
    if (
      !query.state ||
      typeof stored !== "string" ||
      !googleOAuthService.statesEqual(stored, query.state)
    )
      throw createApiError(400, "Invalid Google login state.");
    const redirect = (result: string) => {
      const url = new URL(clientUrl);
      url.searchParams.set("google", result);
      res.redirect(url.toString());
    };
    if (query.error) {
      redirect("error");
      return;
    }
    if (!query.code)
      throw createApiError(400, "Google authorization code is required.");
    try {
      const result = await authService.loginWithGoogle({
        code: query.code,
        nonce: query.state,
        requestMetadata: metadata(req),
      });
      cookies.setAuthCookies(res, result);
      redirect("success");
    } catch (error) {
      const status =
        typeof error === "object" && error !== null && "statusCode" in error
          ? error.statusCode
          : null;
      redirect(
        status === 409
          ? "account_conflict"
          : status === 403
            ? "account_inactive"
            : "error",
      );
    }
  });
  return {
    login,
    register,
    getMe,
    refresh,
    logout,
    verifyEmail,
    resendEmail,
    forgotPassword,
    resetPassword,
    google,
    googleCallback,
  };
};
