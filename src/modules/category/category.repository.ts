import type { Database } from "../../config/database";
export type Category = {
  id: string;
  name: string;
  description: string;
  createdAt: Date;
  createdBy: string;
};
export const createCategoryRepository = ({
  database,
}: {
  database: Database;
}) => ({
  list: async () =>
    (
      await database.query<Category>(
        'SELECT id,name,description,created_at AS "createdAt",created_by AS "createdBy" FROM receipt_tracker.categories ORDER BY lower(name),id',
      )
    ).rows,
  find: async (id: string) =>
    (
      await database.query<Category>(
        'SELECT id,name,description,created_at AS "createdAt",created_by AS "createdBy" FROM receipt_tracker.categories WHERE id=$1',
        [id],
      )
    ).rows[0] ?? null,
  create: async (input: {
    name: string;
    description: string;
    createdBy: string;
  }) =>
    (
      await database.query<Category>(
        'INSERT INTO receipt_tracker.categories(name,description,created_by) VALUES($1,$2,$3) RETURNING id,name,description,created_at AS "createdAt",created_by AS "createdBy"',
        [input.name, input.description, input.createdBy],
      )
    ).rows[0]!,
  update: async (id: string, input: { name?: string; description?: string }) =>
    (
      await database.query<Category>(
        'UPDATE receipt_tracker.categories SET name=COALESCE($2,name),description=COALESCE($3,description) WHERE id=$1 RETURNING id,name,description,created_at AS "createdAt",created_by AS "createdBy"',
        [id, input.name ?? null, input.description ?? null],
      )
    ).rows[0] ?? null,
  remove: async (id: string) =>
    !!(
      await database.query(
        "DELETE FROM receipt_tracker.categories WHERE id=$1 RETURNING id",
        [id],
      )
    ).rowCount,
});
export type CategoryRepository = ReturnType<typeof createCategoryRepository>;
