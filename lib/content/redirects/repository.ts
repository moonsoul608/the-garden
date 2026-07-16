import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { ContentDatabase, Json } from "@/types/database";

import {
  REDIRECT_STATUS_CODE,
  REDIRECT_TYPES,
  type CreateRedirectCommand,
  type RedirectType,
  type RouteRedirect,
} from "./contracts";
import { RedirectError, mapRedirectDatabaseError } from "./errors";

export interface RedirectRepository {
  createRedirect(command: CreateRedirectCommand): Promise<RouteRedirect>;
}

export type RedirectRepositoryClient = SupabaseClient<ContentDatabase>;

const redirectTypes = new Set<RedirectType>(REDIRECT_TYPES);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function mapRedirect(value: Json): RouteRedirect {
  if (!isRecord(value)) {
    throw new RedirectError("redirect_repository_failure");
  }

  const {
    redirectId,
    sourceRoute,
    targetRoute,
    statusCode,
    type,
    reason,
    createdBy,
    createdAt,
  } = value;

  if (
    typeof redirectId !== "string" ||
    typeof sourceRoute !== "string" ||
    typeof targetRoute !== "string" ||
    statusCode !== REDIRECT_STATUS_CODE ||
    !redirectTypes.has(type as RedirectType) ||
    (reason !== null && typeof reason !== "string") ||
    typeof createdBy !== "string" ||
    typeof createdAt !== "string" ||
    !Number.isFinite(Date.parse(createdAt))
  ) {
    throw new RedirectError("redirect_repository_failure");
  }

  return {
    redirectId,
    sourceRoute,
    targetRoute,
    statusCode: REDIRECT_STATUS_CODE,
    type: type as RedirectType,
    reason,
    createdBy,
    createdAt,
  };
}

export function createRedirectRepository(
  client: RedirectRepositoryClient,
): RedirectRepository {
  return {
    async createRedirect(command) {
      const result = await client.rpc("create_route_redirect", {
        p_source_route: command.sourceRoute,
        p_target_route: command.targetRoute,
        p_redirect_type: command.type,
        p_reason: command.reason ?? null,
      });

      if (result.error) throw mapRedirectDatabaseError(result.error);
      return mapRedirect(result.data);
    },
  };
}
