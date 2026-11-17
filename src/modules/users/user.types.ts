export type Role = {
  id: string; name: string; key: string; type: "system" | "custom";
  permissions: string[]; deniedPermissions: string[]; status: "active" | "archived";
};
export type UserRecord = {
  id: string; name: string; email: string; deliveryEmail: string | null; createdBy: string | null; username: string | null; bio: string | null;
  avatar: string | null; googleId: string | null; passwordHash: string | null;
  emailVerifiedAt: Date | null; status: "active" | "inactive"; role: Role;
  createdAt: Date; updatedAt: Date;
};
export type SafeUser = Omit<UserRecord, "passwordHash" | "googleId">;
export type AuthenticatedUser = { id: string; email: string; userSessionId: string; sessionId: string; role: Role };
export type CreateUserInput = {
  name: string; email: string; passwordHash?: string; googleId?: string;
  avatar?: string | null; emailVerifiedAt?: Date; deliveryEmail?: string; createdBy?: string;
};
export type UserUpdates = Partial<Pick<UserRecord, "name" | "username" | "bio" | "avatar" | "passwordHash" | "googleId" | "email" | "emailVerifiedAt" | "deliveryEmail">>;
