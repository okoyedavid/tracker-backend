import type { RoleService } from "./role.service";
import type { roleSchemas } from "./role.schema";
import type { asyncHandler as AsyncHandler } from "../../utils/async-handler";

export const createRoleController=({roleService,schemas,asyncHandler}:{roleService:RoleService;schemas:typeof roleSchemas;asyncHandler:typeof AsyncHandler})=>({
  listRoles:asyncHandler(async(_req,res)=>{res.json({success:true,data:await roleService.listRoles()});}),
  createRole:asyncHandler(async(req,res)=>{
    res.status(201).json({success:true,data:await roleService.createCustomRole(req.user!.role,schemas.create.parse(req.body))});
  }),
  updateRole:asyncHandler(async(req,res)=>{
    res.json({success:true,data:await roleService.updateCustomRole(req.user!.role,schemas.id.parse(req.params).roleId,schemas.update.parse(req.body))});
  }),
  archiveRole:asyncHandler(async(req,res)=>{
    await roleService.archiveCustomRole(schemas.id.parse(req.params).roleId);res.json({message:"Role archived"});
  }),
  assignRole:asyncHandler(async(req,res)=>{
    await roleService.assignRole(req.user!.id,req.user!.role,schemas.userId.parse(req.params).userId,schemas.assign.parse(req.body).roleId);
    res.json({message:"User role updated"});
  }),
  setUserStatus:asyncHandler(async(req,res)=>{
    await roleService.setUserStatus(req.user!.id,schemas.userId.parse(req.params).userId,schemas.status.parse(req.body).status);
    res.json({message:"User status updated"});
  }),
});
