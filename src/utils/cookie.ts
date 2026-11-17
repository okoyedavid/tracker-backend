import type { CookieOptions, Response } from "express";

export const createAuthCookies = ({ secure }: {secure: boolean}) => {
  const options: CookieOptions = { httpOnly: true,secure,sameSite: "lax",path: "/" };
  const stateOptions: CookieOptions = { ...options,path: "/api/auth" };
  const setAuthCookies = (res: Response,tokens: {accessToken: string; refreshToken: string}) => {
    res.cookie("accessToken",tokens.accessToken,{...options,maxAge: 15*60000});
    res.cookie("refreshToken",tokens.refreshToken,{...options,maxAge: 7*86400000});
  };
  const clearAuthCookies = (res: Response) => {
    res.clearCookie("accessToken",options); res.clearCookie("refreshToken",options);
  };
  const setOAuthStateCookie = (res: Response,state: string) => res.cookie("googleOAuthState",state,{...stateOptions,maxAge:10*60000});
  const clearOAuthStateCookie = (res: Response) => res.clearCookie("googleOAuthState",stateOptions);
  return { setAuthCookies,clearAuthCookies,setOAuthStateCookie,clearOAuthStateCookie };
};
export type AuthCookies = ReturnType<typeof createAuthCookies>;
