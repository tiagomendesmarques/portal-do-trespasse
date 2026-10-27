export const SITE_NAME = "Portal do Trespasse";
export const SITE_ENV = (process.env.SITE_ENV ?? "development") as "development" | "staging" | "production";
export const SITE_URL = (process.env.SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
export const isProduction = SITE_ENV === "production";

/** URL absoluto a partir de um caminho ("/my-account/"). */
export function absoluteUrl(path: string): string {
  return SITE_URL + (path.startsWith("/") ? path : `/${path}`);
}

export const ROUTES = {
  home: "/",
  listings: "/all-ads/",
  post: "/post-an-ad/",
  account: "/my-account/",
  accountListings: "/my-account/listings/",
  lostPassword: "/my-account/lost-password/",
  resetPassword: "/my-account/reset-password/",
  verify: "/my-account/verify/",
  logout: "/my-account/logout/",
  terms: "/termos-e-condicoes/",
  privacy: "/politica-de-privacidade/",
} as const;
