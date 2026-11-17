import type { Database } from "../../config/database";
import type { ApiError } from "../../utils/api-error";
import type { UserRepository } from "../users/user.repository";
import type { SafeUser, UserRecord } from "../users/user.types";
import type { SessionService, RequestMetadata } from "../session/session.service";
import type { VerificationService } from "../verification/verification.service";
import type { GoogleOAuthService } from "./google-oauth.adapter";
import type { TokenService } from "../token/token.service";

export type HashService = { hashValue: (value: string) => Promise<string>; compareHash: (value: string,hash: string) => Promise<boolean> };
export const createAuthService = ({ database,userRepository,hashService,sessionService,verificationService,googleOAuthService,
  tokenService,requireEmailConfigured,createApiError }: {
  database: Database; userRepository: UserRepository; hashService: HashService; sessionService: SessionService;
  verificationService: VerificationService; googleOAuthService: GoogleOAuthService; tokenService: TokenService;
  requireEmailConfigured: () => void; createApiError: (status: number,message: string) => ApiError;
}) => {
  const safeUser = (user: UserRecord): SafeUser => {
    const { passwordHash: _password,googleId: _googleId,...safe } = user;
    return safe;
  };
  const requireActive = (user: UserRecord) => {
    if (user.status !== "active" || user.role.status !== "active") throw createApiError(403,"This account or role is inactive.");
    return user;
  };
  const getCurrentUser = async (userId: string) => {
    const user = await userRepository.findUserById(userId);
    if (!user) throw createApiError(404,"User not found.");
    return safeUser(requireActive(user));
  };
  const registerUser = async ({ name,email,password }: {name: string; email: string; password: string}) => {
    tokenService.requireSecrets();
    requireEmailConfigured();
    const existing = await userRepository.findUserByEmail(email);
    if (existing) throw createApiError(409,"Email already in use.");
    const passwordHash = await hashService.hashValue(password);
    return database.transaction(async client => {
      const user = await userRepository.createUser({ name,email,passwordHash },client);
      await verificationService.issueVerificationToken({ userId: user.id,email: user.email,name: user.name },client);
      return { user: safeUser(user) };
    });
  };
  const loginUser = async ({email,password,requestMetadata}: {email: string; password: string; requestMetadata: RequestMetadata}) => {
    tokenService.requireSecrets();
    const user = await userRepository.findUserByEmail(email);
    // A valid bcrypt dummy hash makes unknown-user failures follow the hashing path.
    const hash = user?.passwordHash ?? "$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxLqgVp1lVZcfW5n6pYQkCfR3w6";
    const valid = await hashService.compareHash(password,hash);
    if (!user?.passwordHash || !valid) throw createApiError(401,"Invalid credentials.");
    requireActive(user);
    const session = await sessionService.createLoginSession(user,requestMetadata);
    return { ...session,user: safeUser(user) };
  };
  const loginWithGoogle = async ({code,nonce,requestMetadata}: { code: string; nonce: string; requestMetadata: RequestMetadata }) => {
    tokenService.requireSecrets();
    const profile = await googleOAuthService.authenticateCode(code,nonce);
    const user = await database.transaction(async client => {
      // Serialize Google sign-ins/account linking for the same email.
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [profile.email]);
      let found = await userRepository.findUserByGoogleId(profile.subject,client);
      if (!found) {
        found = await userRepository.findUserByEmail(profile.email,client);
        if (found?.googleId && found.googleId !== profile.subject) throw createApiError(409,"This email is linked to another Google account.");
        // Do not auto-link an unverified password signup to someone else's Google identity.
        if (found && !found.googleId && !found.emailVerifiedAt) throw createApiError(409,"Verify your existing account email before linking Google.");
      }
      if (!found) {
        const candidate = (profile.name || profile.email.split("@")[0] || "Google User").slice(0,50);
        return userRepository.createUser({ email: profile.email,name: candidate.length>=2 ? candidate : "Google User",
          googleId: profile.subject,avatar: profile.picture,emailVerifiedAt: new Date() },client);
      }
      requireActive(found);
      return (await userRepository.updateUserById(found.id, { googleId: profile.subject,
        emailVerifiedAt: found.emailVerifiedAt ?? new Date(),...(!found.googleId && profile.picture ? {avatar: profile.picture} : {}) },client))!;
    });
    return { ...await sessionService.createLoginSession(requireActive(user),requestMetadata),user: safeUser(user) };
  };
  const verifyEmail = async ({email,otp}: {email: string; otp: string}) => {
    const user = await userRepository.findUserByEmail(email);
    if (!user) throw createApiError(400,"Invalid or expired verification code.");
    return verificationService.withVerifiedToken(user.id,otp,"verify_email",async client =>
      safeUser((await userRepository.updateUserById(user.id,{emailVerifiedAt: user.emailVerifiedAt ?? new Date()},client))!));
  };
  const requestCode = async (email: string,purpose: "verify_email" | "reset_password") => {
    tokenService.requireSecrets(); requireEmailConfigured();
    const user = await userRepository.findUserByEmail(email);
    if (!user || user.status !== "active" || (purpose === "verify_email" && user.emailVerifiedAt)) return;
    await verificationService.issueVerificationToken({ userId: user.id,
      email: purpose === "reset_password" ? user.deliveryEmail ?? user.email : user.email,name: user.name,purpose });
  };
  const resetPassword = async ({ email,otp,newPassword }: {email: string; otp: string; newPassword: string}) => {
    const user = await userRepository.findUserByEmail(email);
    if (!user) throw createApiError(400,"Invalid or expired verification code.");
    requireActive(user);
    if (user.passwordHash && await hashService.compareHash(newPassword,user.passwordHash)) throw createApiError(400,"New password must differ from the current password.");
    const passwordHash = await hashService.hashValue(newPassword);
    await verificationService.withVerifiedToken(user.id,otp,"reset_password",async client => {
      await userRepository.updateUserById(user.id,{passwordHash},client);
      await sessionService.revokeAllUserSessions(user.id,client);
    });
  };
  return { safeUser,getCurrentUser,registerUser,loginUser,loginWithGoogle,verifyEmail,requestCode,resetPassword };
};
export type AuthService = ReturnType<typeof createAuthService>;
