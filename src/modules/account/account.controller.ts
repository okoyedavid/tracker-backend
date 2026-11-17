import type { asyncHandler as AsyncHandler } from "../../utils/async-handler";
import type { AccountService } from "./account.service";
import type { accountSchemas } from "./account.schema";
import type { AuthCookies } from "../../utils/cookie";

export const createAccountController = ({
  accountService,
  schemas,
  cookies,
  asyncHandler,
}: {
  accountService: AccountService;
  schemas: typeof accountSchemas;
  cookies: AuthCookies;
  asyncHandler: typeof AsyncHandler;
}) => {
  const updateProfile = asyncHandler(async (req, res) => {
    const user = await accountService.updateProfile(
      req.user!.id,
      schemas.profile.parse(req.body),
    );
    res.json({ success: true, message: "Profile updated", data: user });
  });
  const updateAvatar = asyncHandler(async (req, res) => {
    const user = await accountService.updateProfile(
      req.user!.id,
      schemas.avatar.parse(req.body),
    );
    res.json({ success: true, message: "Avatar updated", data: user });
  });
  const deleteAvatar = asyncHandler(async (req, res) => {
    const user = await accountService.updateProfile(req.user!.id, {
      avatar: null,
    });
    res.json({ success: true, message: "Avatar removed", data: user });
  });
  const changePassword = asyncHandler(async (req, res) => {
    const body = schemas.changePassword.parse(req.body);
    const result = await accountService.changePassword(
      req.user!.id,
      body.currentPassword,
      body.newPassword,
      {
        userAgent: req.get("user-agent")?.slice(0, 512) ?? null,
        ipAddress: req.ip ?? null,
      },
    );
    cookies.setAuthCookies(res, result);
    res.json({ message: "Password changed", userSession: result.userSession });
  });
  const requestEmailChange = asyncHandler(async (req, res) => {
    const body = schemas.changeEmail.parse(req.body);
    await accountService.requestEmailChange(
      req.user!.id,
      body.newEmail,
      body.currentPassword,
    );
    res.json({
      message: "A confirmation code has been sent to the new email.",
    });
  });
  const verifyEmailChange = asyncHandler(async (req, res) => {
    const body = schemas.confirmEmail.parse(req.body);
    const user = await accountService.verifyEmailChange(req.user!.id, body.otp);
    cookies.clearAuthCookies(res);
    res.json({ message: "Email changed. Please log in again.", data: user });
  });
  return {
    updateProfile,
    updateAvatar,
    deleteAvatar,
    changePassword,
    requestEmailChange,
    verifyEmailChange,
  };
};
