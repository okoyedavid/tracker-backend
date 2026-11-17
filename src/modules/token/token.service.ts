import type jwt from "jsonwebtoken";
import type { ApiError } from "../../utils/api-error";

export type AuthTokenPayload = { userId: string; userSessionId: string; sessionId: string; type: "access" | "refresh" };
export const createTokenService = ({ jwtService, accessSecret, refreshSecret, hashToken, createApiError }: {
  jwtService: Pick<typeof jwt, "sign" | "verify">;
  accessSecret: string | undefined;
  refreshSecret: string | undefined;
  hashToken: (token: string) => string;
  createApiError: (status: number, message: string) => ApiError;
}) => {
  const requireSecrets = () => {
    if (!accessSecret || !refreshSecret || accessSecret === refreshSecret) {
      throw createApiError(503, "Configure distinct JWT_ACCESS_SECRET and JWT_REFRESH_SECRET values (at least 32 characters each).");
    }
    return { accessSecret, refreshSecret };
  };
  const mint = (payload: Omit<AuthTokenPayload,"type">) => {
    const secrets = requireSecrets();
    const common = { algorithm: "HS256" as const, issuer: "receipt-tracker", audience: "receipt-tracker-api" };
    return {
      accessToken: jwtService.sign({ ...payload,type: "access" }, secrets.accessSecret, { ...common, expiresIn: "15m" }),
      refreshToken: jwtService.sign({ ...payload,type: "refresh" }, secrets.refreshSecret, { ...common, expiresIn: "7d" }),
    };
  };
  const verify = (token: string, type: AuthTokenPayload["type"]): AuthTokenPayload => {
    const secrets = requireSecrets();
    try {
      const decoded = jwtService.verify(token, type === "access" ? secrets.accessSecret : secrets.refreshSecret, {
        algorithms: ["HS256"], issuer: "receipt-tracker", audience: "receipt-tracker-api",
      });
      if (typeof decoded !== "object" || decoded.type !== type ||
          ![decoded.userId,decoded.userSessionId,decoded.sessionId].every(value => typeof value === "string" && /^[a-f\d-]{36}$/i.test(value))) throw new Error("Invalid claims");
      return decoded as AuthTokenPayload;
    } catch { throw createApiError(401, "Invalid or expired token."); }
  };
  const signReceipt=(claims:{userId:string;imageHash:string;responseHash:string;version?:2})=>jwtService.sign({...claims,type:'receipt-review'},requireSecrets().accessSecret,
    {algorithm:'HS256',issuer:'receipt-tracker',audience:'receipt-review',expiresIn:'24h'});
  const verifyReceipt=(token:string)=>{
    try {
      const claims=jwtService.verify(token,requireSecrets().accessSecret,{algorithms:['HS256'],issuer:'receipt-tracker',audience:'receipt-review'});
      if(typeof claims!=='object'||claims.type!=='receipt-review'||![claims.userId,claims.imageHash,claims.responseHash].every(value=>typeof value==='string'))throw new Error('Invalid review');
      return claims as {userId:string;imageHash:string;responseHash:string;version?:2};
    }catch{throw createApiError(400,'OCR review expired or invalid. Scan the image again.');}
  };
  return { mint, verify, hashToken, requireSecrets, signReceipt, verifyReceipt };
};
export type TokenService = ReturnType<typeof createTokenService>;
