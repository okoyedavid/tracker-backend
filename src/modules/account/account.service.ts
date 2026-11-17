import type { Database } from "../../config/database";
import type { ApiError } from "../../utils/api-error";
import type { UserRepository } from "../users/user.repository";
import type { AuthService, HashService } from "../auth/auth.service";
import type {
  SessionService,
  RequestMetadata,
} from "../session/session.service";
import type { VerificationService } from "../verification/verification.service";

export const createAccountService = ({
  database,
  userRepository,
  authService,
  hashService,
  sessionService,
  verificationService,
  createApiError,
}: {
  database: Database;
  userRepository: UserRepository;
  authService: AuthService;
  hashService: HashService;
  sessionService: SessionService;
  verificationService: VerificationService;
  createApiError: (status: number, message: string) => ApiError;
}) => {
  const updateProfile = async (
    userId: string,
    updates: {
      name?: string;
      username?: string | null;
      bio?: string | null;
      avatar?: string | null;
    },
  ) => {
    const user = await userRepository.updateUserById(userId, updates);
    if (!user) throw createApiError(404, "User not found.");
    return authService.safeUser(user);
  };
  const changePassword = async (
    userId: string,
    currentPassword: string,
    newPassword: string,
    metadata: RequestMetadata,
  ) =>
    database.transaction(async (client) => {
      await client.query(
        "SELECT id FROM receipt_tracker.users WHERE id=$1 FOR UPDATE",
        [userId],
      );
      const user = await userRepository.findUserById(userId, client);
      if (!user?.passwordHash)
        throw createApiError(
          400,
          "Use the email password-reset flow to set a password for this Google account.",
        );
      if (!(await hashService.compareHash(currentPassword, user.passwordHash)))
        throw createApiError(401, "Invalid current password.");
      if (await hashService.compareHash(newPassword, user.passwordHash))
        throw createApiError(
          400,
          "New password must differ from the current password.",
        );
      const updated = await userRepository.updateUserById(
        userId,
        { passwordHash: await hashService.hashValue(newPassword) },
        client,
      );
      await sessionService.revokeAllUserSessions(userId, client);
      return sessionService.createLoginSession(updated!, metadata, client);
    });
  const requestEmailChange = async (
    userId: string,
    newEmail: string,
    currentPassword?: string,
  ) => {
    const user = await userRepository.findUserById(userId);
    if (!user) throw createApiError(404, "User not found.");
    if (!user.passwordHash)
      throw createApiError(
        400,
        "Set a password using email password reset before changing this Google account's email.",
      );
    if (
      !currentPassword ||
      !(await hashService.compareHash(currentPassword, user.passwordHash))
    )
      throw createApiError(
        401,
        "Current password is required to change email.",
      );
    if (user.email === newEmail)
      throw createApiError(400, "New email must be different.");
    if (await userRepository.findUserByEmail(newEmail))
      throw createApiError(409, "Email already in use.");
    await verificationService.issueVerificationToken({
      userId,
      email: newEmail,
      name: user.name,
      purpose: "change_email",
      targetEmail: newEmail,
    });
  };
  const verifyEmailChange = async (userId: string, otp: string) =>
    verificationService.withVerifiedToken(
      userId,
      otp,
      "change_email",
      async (client, targetEmail) => {
        if (!targetEmail) throw createApiError(400, "No pending email change.");
        const existing = await userRepository.findUserByEmail(
          targetEmail,
          client,
        );
        if (existing && existing.id !== userId)
          throw createApiError(409, "Email already in use.");
        // The old Google subject must not remain linked to a newly changed address.
        const updated = await userRepository.updateUserById(
          userId,
          { email: targetEmail, emailVerifiedAt: new Date(), googleId: null, deliveryEmail: null },
          client,
        );
        await sessionService.revokeAllUserSessions(userId, client);
        return authService.safeUser(updated!);
      },
    );
  return {
    updateProfile,
    changePassword,
    requestEmailChange,
    verifyEmailChange,
  };
};
export type AccountService = ReturnType<typeof createAccountService>;
