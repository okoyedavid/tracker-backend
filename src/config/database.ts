import type { Pool, PoolClient, QueryResult, QueryResultRow } from "pg";
import type { ApiError } from "../utils/api-error";

export type SqlClient = {
  query: <T extends QueryResultRow = QueryResultRow>(
    sql: string,
    values?: unknown[],
  ) => Promise<QueryResult<T>>;
};
export type Database = SqlClient & {
  transaction: <T>(work: (client: SqlClient) => Promise<T>) => Promise<T>;
  close: () => Promise<void>;
};

export const createDatabase = ({
  pool,
  createApiError,
}: {
  pool: Pool | undefined;
  createApiError: (status: number, message: string) => ApiError;
}): Database => {
  const requirePool = () => {
    if (!pool) throw createApiError(503, "Database is not configured.");
    return pool;
  };
  const query = <T extends QueryResultRow>(sql: string, values?: unknown[]) =>
    requirePool().query<T>(sql, values);
  const transaction = async <T>(
    work: (client: SqlClient) => Promise<T>,
  ): Promise<T> => {
    const client: PoolClient = await requirePool().connect();
    try {
      await client.query("BEGIN");
      const value = await work(client);
      await client.query("COMMIT");
      return value;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  };
  return {
    query,
    transaction,
    close: async () => {
      await pool?.end();
    },
  };
};
