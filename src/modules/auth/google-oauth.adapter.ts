import type { ApiError } from "../../utils/api-error";

export type GoogleProfile = { subject: string; email: string; name: string | null; picture: string | null };
// OAuth credentials are supplied by the module.
export const createGoogleOAuthAdapter = ({ configuration,request,createState,statesEqual,createApiError }: {
  configuration: { clientId?: string; clientSecret?: string; redirectUrl?: string };
  request: typeof fetch; createState: () => string; statesEqual: (a: string,b: string) => boolean;
  createApiError: (status: number,message: string) => ApiError;
}) => {
  const requireConfiguration = () => {
    const { clientId,clientSecret,redirectUrl } = configuration;
    if (!clientId || !clientSecret || !redirectUrl) throw createApiError(503,"Google login is not configured.");
    return { clientId,clientSecret,redirectUrl };
  };
  const getAuthorizationUrl = (state: string) => {
    const config = requireConfiguration();
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.search = new URLSearchParams({ client_id: config.clientId,redirect_uri: config.redirectUrl,response_type: "code",
      scope: "openid email profile",state,nonce: state,access_type: "online",prompt: "select_account" }).toString();
    return url.toString();
  };
  const authenticateCode = async (code: string,nonce: string): Promise<GoogleProfile> => {
    const config = requireConfiguration();
    let tokenResponse: Response;
    try {
      tokenResponse = await request("https://oauth2.googleapis.com/token", {
        method: "POST",signal: AbortSignal.timeout(10000),headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ code,client_id: config.clientId,client_secret: config.clientSecret,
          redirect_uri: config.redirectUrl,grant_type: "authorization_code" }),
      });
    } catch { throw createApiError(502,"Google token exchange is unavailable."); }
    if (!tokenResponse.ok) throw createApiError(401,"Google token exchange failed.");
    const tokens = await tokenResponse.json() as { id_token?: unknown };
    if (typeof tokens.id_token !== "string") throw createApiError(401,"Google returned no identity token.");
    let response: Response;
    try {
      response = await request(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(tokens.id_token)}`, { signal: AbortSignal.timeout(10000) });
    } catch { throw createApiError(502,"Google identity verification is unavailable."); }
    if (!response.ok) throw createApiError(401,"Invalid Google identity token.");
    const profile = await response.json() as Record<string,unknown>;
    if (typeof profile.sub !== "string" || !profile.sub || typeof profile.email !== "string" ||
        (profile.email_verified !== true && profile.email_verified !== "true") ||
        !["accounts.google.com","https://accounts.google.com"].includes(String(profile.iss)) ||
        profile.aud !== config.clientId || profile.nonce !== nonce ||
        !Number.isFinite(Number(profile.exp)) || Number(profile.exp)*1000 <= Date.now()) {
      throw createApiError(401,"Google identity verification failed.");
    }
    return { subject: profile.sub,email: profile.email.trim().toLowerCase(),
      name: typeof profile.name === "string" ? profile.name.trim() || null : null,
      picture: typeof profile.picture === "string" && profile.picture.startsWith("https://") ? profile.picture : null };
  };
  return { createState,statesEqual,getAuthorizationUrl,authenticateCode };
};
export type GoogleOAuthService = ReturnType<typeof createGoogleOAuthAdapter>;
