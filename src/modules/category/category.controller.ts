import type { asyncHandler as AsyncHandler } from "../../utils/async-handler";
import type { CategoryService } from "./category.service";
import type { categorySchemas } from "./category.schema";

export const createCategoryController = ({
  service,
  schemas,
  asyncHandler,
}: {
  service: CategoryService;
  schemas: typeof categorySchemas;
  asyncHandler: typeof AsyncHandler;
}) => ({
  list: asyncHandler(async (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.json({ data: await service.list() });
  }),
  create: asyncHandler(async (req, res) => {
    res.status(201).json({
      data: await service.create(req.user!, schemas.create.parse(req.body)),
    });
  }),
  update: asyncHandler(async (req, res) => {
    res.json({
      data: await service.update(
        req.user!,
        schemas.id.parse(req.params).id,
        schemas.update.parse(req.body),
      ),
    });
  }),
  remove: asyncHandler(async (req, res) => {
    await service.remove(req.user!, schemas.id.parse(req.params).id);
    res.status(204).send();
  }),
});
