import type { Database } from "../../config/database";
import type { ApiError } from "../../utils/api-error";
import type { EmailService } from "../email/email.service";
import type { UserRepository } from "./user.repository";
import type { AuthenticatedUser, SafeUser } from "./user.types";

export const createUserService = ({ database, userRepository, emailService, hashPassword, randomUUID, createApiError }: {
  database: Database; userRepository: UserRepository; emailService: EmailService;
  hashPassword: (password: string) => Promise<string>; randomUUID: () => string;
  createApiError: (status: number, message: string) => ApiError;
}) => {
  const provisionUser = async (actor: AuthenticatedUser, input: { name: string; email: string; password: string; deliveryEmail?: string }) => {
    if (actor.role.key !== "supervisor" || actor.role.type !== "system" ||
      !actor.role.permissions.includes("user:create") || actor.role.deniedPermissions.includes("user:create")) {
      throw createApiError(403, "Only supervisors with user:create permission can create accounts.");
    }
    if (input.deliveryEmail) emailService.requireConfigured();
    if (await userRepository.findUserByEmail(input.email)) throw createApiError(409, "Email already in use.");
    const password = input.password;
    const passwordHash = await hashPassword(password);
    const deliveryEmail = input.deliveryEmail;
    return database.transaction(async client => {
      const user = await userRepository.createUser({ name: input.name, email: input.email, passwordHash,
        emailVerifiedAt: new Date(), deliveryEmail, createdBy: actor.id }, client);
      if (deliveryEmail) {
        await emailService.sendAccountCredentialsEmail({ to: deliveryEmail, name: user.name, loginEmail: user.email,
          password, deliveryId: randomUUID() });
      }
      const { passwordHash: _passwordHash, googleId: _googleId, ...safe } = user;
      return { user: safe satisfies SafeUser, deliveryEmail: deliveryEmail ?? null,
        deliveryMethod: deliveryEmail ? "email" as const : "manual" as const };
    });
  };
  return { provisionUser };
};
export type UserService = ReturnType<typeof createUserService>;
