import type { Database, SqlClient } from "../../config/database";
import type { CreateUserInput, UserRecord, UserUpdates } from "./user.types";

// Expose database fields in the API's camelCase shape.
const userSelect = `SELECT u.id,u.name,u.email,u.delivery_email AS "deliveryEmail",u.created_by AS "createdBy",u.username,u.bio,u.avatar,
 u.password_hash AS "passwordHash",u.google_id AS "googleId",u.email_verified_at AS "emailVerifiedAt",
 u.status,u.created_at AS "createdAt",u.updated_at AS "updatedAt",
 json_build_object('id',r.id,'name',r.name,'key',r.key,'type',r.type,'permissions',r.permissions,
 'deniedPermissions',r.denied_permissions,'status',r.status) AS role
 FROM receipt_tracker.users u JOIN receipt_tracker.roles r ON r.id=u.role_id`;

export const createUserRepository = ({ database }: { database: Database }) => {
  const find = async (condition: string, value: string, client: SqlClient = database) => {
    const result = await client.query<UserRecord>(`${userSelect} WHERE ${condition}`, [value]);
    return result.rows[0] ?? null;
  };
  const findUserById = (id: string, client?: SqlClient) => find("u.id=$1", id, client);
  const findUserByEmail = (email: string, client?: SqlClient) => find("lower(u.email)=lower($1)", email.trim(), client);
  const findUserByGoogleId = (id: string, client?: SqlClient) => find("u.google_id=$1", id, client);
  const createUser = async (input: CreateUserInput, client: SqlClient = database) => {
    const result = await client.query<{id: string}>(`INSERT INTO receipt_tracker.users
     (name,email,password_hash,google_id,avatar,email_verified_at,delivery_email,created_by,role_id)
     VALUES($1,lower($2),$3,$4,$5,$6,$7,$8,(SELECT id FROM receipt_tracker.roles WHERE key='worker' AND status='active')) RETURNING id`,
    [input.name,input.email,input.passwordHash ?? null,input.googleId ?? null,input.avatar ?? null,input.emailVerifiedAt ?? null,input.deliveryEmail ?? null,input.createdBy ?? null]);
    return (await findUserById(result.rows[0]!.id, client))!;
  };
  const updateUserById = async (id: string, updates: UserUpdates, client: SqlClient = database) => {
    const columns: Record<keyof UserUpdates, string> = {
      name: "name", username: "username", bio: "bio", avatar: "avatar", passwordHash: "password_hash",
      googleId: "google_id", email: "email", emailVerifiedAt: "email_verified_at", deliveryEmail: "delivery_email",
    };
    const entries = Object.entries(updates).filter(([key,value]) => Object.hasOwn(columns,key) && value !== undefined);
    if (entries.length) {
      const assignments = entries.map(([key],i) => `${columns[key as keyof UserUpdates]}=$${i+2}`);
      await client.query(`UPDATE receipt_tracker.users SET ${assignments.join(",")},updated_at=now() WHERE id=$1`, [id,...entries.map(([,v])=>v)]);
    }
    return findUserById(id, client);
  };
  return { findUserById, findUserByEmail, findUserByGoogleId, createUser, updateUserById };
};
export type UserRepository = ReturnType<typeof createUserRepository>;
