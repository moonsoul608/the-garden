import "server-only";

export const REDIRECT_STATUS_CODE = 308 as const;

export const REDIRECT_TYPES = [
  "slug_migration",
  "region_migration",
  "content_move",
] as const;

export type RedirectType = (typeof REDIRECT_TYPES)[number];

export type CreateRedirectCommand = Readonly<{
  sourceRoute: string;
  targetRoute: string;
  type: RedirectType;
  reason?: string | null;
}>;

/** Domain-safe redirect record; database column names stay private. */
export type RouteRedirect = Readonly<{
  redirectId: string;
  sourceRoute: string;
  targetRoute: string;
  statusCode: typeof REDIRECT_STATUS_CODE;
  type: RedirectType;
  reason: string | null;
  createdBy: string;
  createdAt: string;
}>;

export interface RedirectService {
  createRedirect(command: CreateRedirectCommand): Promise<RouteRedirect>;
}
