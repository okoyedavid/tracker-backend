import type { Database } from "../../config/database";
import type { UserListQuery, UserListResult } from "./admin.types";

export const createAdminRepository = ({ database }: { database: Database }) => ({
  listUsers: async ({ page, limit, search, status, roleId }: UserListQuery): Promise<UserListResult> => {
    // Select only directory fields. Password hashes, Google IDs and recovery addresses never enter this result.
    const result = await database.query<UserListResult>(`
      WITH filtered AS (
        SELECT u.id,u.name,u.email,u.username,u.avatar,u.status,
          u.email_verified_at AS "emailVerifiedAt",u.created_at AS "createdAt",
          json_build_object('id',r.id,'name',r.name,'key',r.key,'type',r.type,'status',r.status) AS role
        FROM receipt_tracker.users u
        JOIN receipt_tracker.roles r ON r.id=u.role_id
        WHERE ($1::text='' OR strpos(lower(u.name || ' ' || u.email || ' ' || r.name),lower($1))>0)
          AND ($2::text IS NULL OR u.status=$2)
          AND ($3::uuid IS NULL OR u.role_id=$3)
      ), paged AS (
        SELECT * FROM filtered ORDER BY "createdAt" DESC,id LIMIT $4 OFFSET $5
      )
      SELECT COALESCE((SELECT json_agg(p ORDER BY p."createdAt" DESC,p.id) FROM paged p),'[]'::json) AS users,
        (SELECT count(*)::int FROM filtered) AS total`,
    [search, status ?? null, roleId ?? null, limit, (page - 1) * limit]);
    return result.rows[0]!;
  },
});
export type AdminRepository = ReturnType<typeof createAdminRepository>;
