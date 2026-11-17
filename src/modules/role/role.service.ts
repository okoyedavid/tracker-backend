import type { Database } from "../../config/database";
import type { RoleRepository } from "./role.repository";
import type { UserRepository } from "../users/user.repository";
import type { Role } from "../users/user.types";
import type { SessionService } from "../session/session.service";
import type { ApiError } from "../../utils/api-error";

export const createRoleService=({database,roleRepository,userRepository,sessionService,createApiError}:{
  database:Database;roleRepository:RoleRepository;userRepository:UserRepository;sessionService:SessionService;
  createApiError:(status:number,message:string)=>ApiError;
})=>{
  const assertCanGrant=(actor:Role,permissions:string[],deniedPermissions:string[])=>{
    if(deniedPermissions.some(value=>!permissions.includes(value))) throw createApiError(400,"Denied permissions must also be granted by the role.");
    const grants=new Set(actor.permissions.filter(value=>!actor.deniedPermissions.includes(value)));
    if(permissions.some(value=>!deniedPermissions.includes(value)&&!grants.has(value))) throw createApiError(403,"You cannot grant permissions you do not have.");
  };
  const createCustomRole=async(actor:Role,input:{name:string;permissions:string[];deniedPermissions:string[]})=>{
    assertCanGrant(actor,input.permissions,input.deniedPermissions);
    const key=input.name.toLowerCase().replace(/[^a-z0-9]+/g,"_").replace(/^_+|_+$/g,"");
    if(!key) throw createApiError(400,"Role name must contain letters or numbers.");
    return roleRepository.createRole({...input,key});
  };
  const updateCustomRole=async(actor:Role,roleId:string,updates:{name?:string;permissions?:string[];deniedPermissions?:string[]})=>database.transaction(async client=>{
    await client.query("SELECT id FROM receipt_tracker.roles WHERE id=$1 FOR UPDATE",[roleId]);
    const role=await roleRepository.findRole(roleId,client);
    if(!role || role.status!=="active") throw createApiError(404,"Role not found.");
    if(role.type!=="custom") throw createApiError(403,"System roles cannot be edited.");
    const input={name:updates.name??role.name,permissions:updates.permissions??role.permissions,deniedPermissions:updates.deniedPermissions??role.deniedPermissions};
    assertCanGrant(actor,input.permissions,input.deniedPermissions);
    return roleRepository.updateRole(roleId,input,client);
  });
  const archiveCustomRole=async(roleId:string)=>database.transaction(async client=>{
    await client.query("SELECT id FROM receipt_tracker.roles WHERE id=$1 FOR UPDATE",[roleId]);
    const role=await roleRepository.findRole(roleId,client);
    if(!role) throw createApiError(404,"Role not found.");
    if(role.type!=="custom") throw createApiError(403,"System roles cannot be archived.");
    const assigned=await client.query("SELECT id FROM receipt_tracker.users WHERE role_id=$1 LIMIT 1",[roleId]);
    if(assigned.rowCount) throw createApiError(409,"Reassign users before archiving this role.");
    await client.query("UPDATE receipt_tracker.roles SET status='archived',updated_at=now() WHERE id=$1",[roleId]);
  });
  const assignRole=async(actorId:string,actor:Role,userId:string,roleId:string)=>database.transaction(async client=>{
    if(actorId===userId) throw createApiError(403,"You cannot change your own role.");
    await client.query("SELECT id FROM receipt_tracker.roles WHERE id=$1 FOR UPDATE",[roleId]);
    const role=await roleRepository.findRole(roleId,client);
    if(!role || role.status!=="active") throw createApiError(404,"Active role not found.");
    assertCanGrant(actor,role.permissions,role.deniedPermissions);
    await client.query("SELECT id FROM receipt_tracker.users WHERE id=$1 FOR UPDATE",[userId]);
    if(!await userRepository.findUserById(userId,client)) throw createApiError(404,"User not found.");
    await client.query("UPDATE receipt_tracker.users SET role_id=$2,updated_at=now() WHERE id=$1",[userId,roleId]);
  });
  const setUserStatus=async(actorId:string,userId:string,status:"active"|"inactive")=>database.transaction(async client=>{
    if(actorId===userId) throw createApiError(403,"You cannot change your own status.");
    await client.query("SELECT id FROM receipt_tracker.users WHERE id=$1 FOR UPDATE",[userId]);
    if(!await userRepository.findUserById(userId,client)) throw createApiError(404,"User not found.");
    await client.query("UPDATE receipt_tracker.users SET status=$2,updated_at=now() WHERE id=$1",[userId,status]);
    if(status==="inactive") await sessionService.revokeAllUserSessions(userId,client);
  });
  return {listRoles:roleRepository.listRoles,createCustomRole,updateCustomRole,archiveCustomRole,assignRole,setUserStatus};
};
export type RoleService=ReturnType<typeof createRoleService>;
