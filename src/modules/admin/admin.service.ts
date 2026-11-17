import type { AdminRepository } from "./admin.repository";
import type { UserListQuery } from "./admin.types";

export const createAdminService = ({ adminRepository }: { adminRepository: AdminRepository }) => ({
  listUsers: async (query: UserListQuery) => {
    const { users, total } = await adminRepository.listUsers(query);
    return { data: users, pagination: { page: query.page, limit: query.limit, total, pageCount: Math.ceil(total / query.limit) } };
  },
});
export type AdminService = ReturnType<typeof createAdminService>;
