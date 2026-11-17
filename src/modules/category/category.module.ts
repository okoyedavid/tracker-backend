import { database } from "../../config/database.module";
import { ApiError } from "../../utils/api-error";
import { asyncHandler } from "../../utils/async-handler";
import { createCategoryRepository } from "./category.repository";
import { createCategoryService } from "./category.service";
import { createCategoryController } from "./category.controller";
import { categorySchemas } from "./category.schema";
export const categoryRepository = createCategoryRepository({ database });
const service = createCategoryService({
  repository: categoryRepository,
  createApiError: (status, message) => new ApiError(status, message),
});
export const categoryController = createCategoryController({
  service,
  schemas: categorySchemas,
  asyncHandler,
});
