import type { CategoryRepository } from "./category.repository";
import type { AuthenticatedUser } from "../users/user.types";
import type { ApiError } from "../../utils/api-error";
export const createCategoryService = ({ repository, createApiError }: { repository: CategoryRepository; createApiError: (status: number,message: string) => ApiError }) => {
  const requireSupervisor=(actor:AuthenticatedUser,permission:string)=>{
    if(actor.role.key!=="supervisor"||actor.role.type!=="system"||actor.role.status!=="active"||
      !actor.role.permissions.includes(permission)||actor.role.deniedPermissions.includes(permission)){
      throw createApiError(403,"Only supervisors with the required permission can manage categories.");
    }
  };
  return {
  list: repository.list,
  create: (actor: AuthenticatedUser, input: { name: string; description: string }) => {
    requireSupervisor(actor,"categories:create");
    return repository.create({ ...input,createdBy:actor.id });
  },
  update:async(actor:AuthenticatedUser,id:string,input:{name?:string;description?:string})=>{
    requireSupervisor(actor,"categories:update");
    const category=await repository.update(id,input);
    if(!category)throw createApiError(404,"Category not found.");
    return category;
  },
  remove:async(actor:AuthenticatedUser,id:string)=>{
    requireSupervisor(actor,"categories:delete");
    try{if(!await repository.remove(id))throw createApiError(404,"Category not found.");}
    catch(error){
      if(typeof error==="object"&&error!==null&&"code"in error&&error.code==="23503"){
        throw createApiError(409,"This category is used by saved scans and cannot be deleted. You can update its name or description.");
      }
      throw error;
    }
  },
  };
};
export type CategoryService = ReturnType<typeof createCategoryService>;
