import type { Database,SqlClient } from "../../config/database";
import type { Role } from "../users/user.types";

const select=`SELECT id,name,key,type,permissions,denied_permissions AS "deniedPermissions",status FROM receipt_tracker.roles`;
export const createRoleRepository=({database}:{database:Database})=>{
  const listRoles=async()=> (await database.query<Role>(`${select} WHERE status='active' ORDER BY type DESC,name`)).rows;
  const findRole=async(id:string,client:SqlClient=database)=> (await client.query<Role>(`${select} WHERE id=$1`,[id])).rows[0]??null;
  const createRole=async(input:{name:string;key:string;permissions:string[];deniedPermissions:string[]})=>{
    const result=await database.query<Role>(`INSERT INTO receipt_tracker.roles(name,key,type,permissions,denied_permissions)
      VALUES($1,$2,'custom',$3,$4) RETURNING id,name,key,type,permissions,denied_permissions AS "deniedPermissions",status`,
      [input.name,input.key,input.permissions,input.deniedPermissions]);
    return result.rows[0]!;
  };
  const updateRole=async(id:string,input:{name:string;permissions:string[];deniedPermissions:string[]},client:SqlClient)=>{
    await client.query("UPDATE receipt_tracker.roles SET name=$2,permissions=$3,denied_permissions=$4,updated_at=now() WHERE id=$1",[id,input.name,input.permissions,input.deniedPermissions]);
    return findRole(id,client);
  };
  return {listRoles,findRole,createRole,updateRole};
};
export type RoleRepository=ReturnType<typeof createRoleRepository>;
