export type UserListQuery = {
  page: number;
  limit: number;
  search: string;
  status?: "active" | "inactive";
  roleId?: string;
};

export type AdminUser = {
  id: string;
  name: string;
  email: string;
  username: string | null;
  avatar: string | null;
  status: "active" | "inactive";
  emailVerifiedAt: string | null;
  createdAt: string;
  role: { id: string; name: string; key: string; type: "system" | "custom"; status: string };
};

export type UserListResult = { users: AdminUser[]; total: number };
