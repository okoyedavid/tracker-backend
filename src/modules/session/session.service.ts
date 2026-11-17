import type { Database, SqlClient } from "../../config/database";
import type { TokenService } from "../token/token.service";
import type { UserRepository } from "../users/user.repository";
import type { UserRecord } from "../users/user.types";
import type { ApiError } from "../../utils/api-error";

export type RequestMetadata = {
  userAgent: string | null;
  ipAddress: string | null;
};
type SessionRow = {
  id: string;
  userId: string;
  expiresAt: Date;
  revokedAt: Date | null;
  currentAuthSessionId: string | null;
};
type AuthSessionRow = {
  id: string;
  userSessionId: string;
  refreshTokenHash: string;
  revokedAt: Date | null;
  expiresAt: Date;
  replacedBySessionId: string | null;
};

export const createSessionService = ({
  database,
  tokenService,
  userRepository,
  randomUUID,
  createApiError,
}: {
  database: Database;
  tokenService: TokenService;
  userRepository: UserRepository;
  randomUUID: () => string;
  createApiError: (status: number, message: string) => ApiError;
}) => {
  const revokeUserSession = async (
    id: string,
    client: SqlClient = database,
  ) => {
    await client.query(
      "UPDATE receipt_tracker.user_sessions SET revoked_at=COALESCE(revoked_at,now()),current_auth_session_id=NULL WHERE id=$1",
      [id],
    );
    await client.query(
      "UPDATE receipt_tracker.auth_sessions SET revoked_at=COALESCE(revoked_at,now()) WHERE user_session_id=$1",
      [id],
    );
  };
  const revokeAllUserSessions = async (userId: string, client: SqlClient) => {
    const rows = await client.query<{ id: string }>(
      "SELECT id FROM receipt_tracker.user_sessions WHERE user_id=$1 FOR UPDATE",
      [userId],
    );
    for (const row of rows.rows) await revokeUserSession(row.id, client);
    return { revokedCount: rows.rowCount ?? 0 };
  };
  const createLoginSession = async (
    user: UserRecord,
    metadata: RequestMetadata,
    transaction?: SqlClient,
  ) => {
    const userSessionId = randomUUID(),
      sessionId = randomUUID();
    const tokens = tokenService.mint({
      userId: user.id,
      userSessionId,
      sessionId,
    });
    const expiresAt = new Date(Date.now() + 7 * 86400000);
    const persist = async (client: SqlClient) => {
      await client.query(
        `INSERT INTO receipt_tracker.user_sessions(id,user_id,current_auth_session_id,user_agent,ip_address,expires_at)
        VALUES($1,$2,$3,$4,$5,$6)`,
        [
          userSessionId,
          user.id,
          sessionId,
          metadata.userAgent,
          metadata.ipAddress,
          expiresAt,
        ],
      );
      await client.query(
        `INSERT INTO receipt_tracker.auth_sessions(id,user_session_id,refresh_token_hash,expires_at) VALUES($1,$2,$3,$4)`,
        [
          sessionId,
          userSessionId,
          tokenService.hashToken(tokens.refreshToken),
          expiresAt,
        ],
      );
    };
    if (transaction) await persist(transaction);
    else await database.transaction(persist);
    return {
      ...tokens,
      userSession: {
        userSessionId,
        currentAuthSessionId: sessionId,
        expiresAt,
      },
    };
  };
  const getSession = async (
    id: string,
    client: SqlClient = database,
    lock = false,
  ) => {
    const rows = await client.query<SessionRow>(
      `SELECT id,user_id AS "userId",current_auth_session_id AS "currentAuthSessionId",
      expires_at AS "expiresAt",revoked_at AS "revokedAt" FROM receipt_tracker.user_sessions WHERE id=$1 ${lock ? "FOR UPDATE" : ""}`,
      [id],
    );
    return rows.rows[0];
  };
  const authenticateAccess = async (token: string) => {
    const claims = tokenService.verify(token, "access");
    const [session, user] = await Promise.all([
      getSession(claims.userSessionId),
      userRepository.findUserById(claims.userId),
    ]);
    if (
      !session ||
      session.userId !== claims.userId ||
      session.revokedAt ||
      session.expiresAt <= new Date()
    )
      throw createApiError(401, "Session is no longer active.");
    if (!user || user.status !== "active" || user.role.status !== "active")
      throw createApiError(403, "Account or role is inactive.");
    return {
      id: user.id,
      email: user.email,
      userSessionId: claims.userSessionId,
      sessionId: claims.sessionId,
      role: user.role,
    };
  };
  const refreshUserSession = async (refreshToken: string) => {
    const claims = tokenService.verify(refreshToken, "refresh");
    const outcome = await database.transaction(async (client) => {
      const session = await getSession(claims.userSessionId, client, true);
      if (
        !session ||
        session.userId !== claims.userId ||
        session.revokedAt ||
        session.expiresAt <= new Date()
      )
        return { error: createApiError(401, "Session is no longer active.") };
      const rows = await client.query<AuthSessionRow>(
        `SELECT id,user_session_id AS "userSessionId",refresh_token_hash AS "refreshTokenHash",
        expires_at AS "expiresAt",revoked_at AS "revokedAt",replaced_by_session_id AS "replacedBySessionId"
        FROM receipt_tracker.auth_sessions WHERE id=$1 FOR UPDATE`,
        [claims.sessionId],
      );
      const auth = rows.rows[0];
      if (
        !auth ||
        auth.userSessionId !== session.id ||
        auth.refreshTokenHash !== tokenService.hashToken(refreshToken)
      ) {
        await revokeUserSession(session.id, client);
        return { error: createApiError(401, "Invalid refresh session.") };
      }
      if (
        auth.revokedAt &&
        auth.replacedBySessionId &&
        Date.now() - auth.revokedAt.getTime() < 20000
      ) {
        return {
          error: createApiError(
            409,
            "Refresh token recently rotated. Another refresh may already have completed.",
          ),
        };
      }
      if (
        auth.revokedAt ||
        auth.expiresAt <= new Date() ||
        session.currentAuthSessionId !== auth.id
      ) {
        await revokeUserSession(session.id, client);
        return {
          error: createApiError(
            401,
            "Refresh token reuse detected. Please log in again.",
          ),
        };
      }
      const user = await userRepository.findUserById(claims.userId, client);
      if (!user || user.status !== "active" || user.role.status !== "active") {
        await revokeUserSession(session.id, client);
        return { error: createApiError(403, "Account or role is inactive.") };
      }
      const sessionId = randomUUID(),
        expiresAt = new Date(Date.now() + 7 * 86400000);
      const tokens = tokenService.mint({
        userId: user.id,
        userSessionId: session.id,
        sessionId,
      });
      await client.query(
        "INSERT INTO receipt_tracker.auth_sessions(id,user_session_id,refresh_token_hash,expires_at) VALUES($1,$2,$3,$4)",
        [
          sessionId,
          session.id,
          tokenService.hashToken(tokens.refreshToken),
          expiresAt,
        ],
      );
      await client.query(
        "UPDATE receipt_tracker.auth_sessions SET revoked_at=now(),replaced_by_session_id=$2 WHERE id=$1",
        [auth.id, sessionId],
      );
      await client.query(
        "UPDATE receipt_tracker.user_sessions SET current_auth_session_id=$2,expires_at=$3,last_seen_at=now() WHERE id=$1",
        [session.id, sessionId, expiresAt],
      );
      return {
        value: {
          ...tokens,
          userSession: {
            userSessionId: session.id,
            currentAuthSessionId: sessionId,
            expiresAt,
          },
        },
      };
    });
    // Throw after COMMIT so replay-triggered revocation is not rolled back.
    if (outcome.error) throw outcome.error;
    return outcome.value!;
  };
  const logoutUser = async (refreshToken: string | undefined) => {
    if (!refreshToken) return;
    const claims = tokenService.verify(refreshToken, "refresh");
    await database.transaction(async (client) => {
      const session = await getSession(claims.userSessionId, client, true);
      if (session?.userId === claims.userId)
        await revokeUserSession(session.id, client);
    });
  };
  return {
    createLoginSession,
    refreshUserSession,
    authenticateAccess,
    logoutUser,
    revokeAllUserSessions,
  };
};
export type SessionService = ReturnType<typeof createSessionService>;
