import "server-only";

import type { AuthenticatedUser } from "@/lib/auth";
import { requireGardenKeeper } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

import {
  REDIRECT_TYPES,
  type CreateRedirectCommand,
  type RedirectService,
  type RedirectType,
  type RouteRedirect,
} from "./contracts";
import { RedirectError } from "./errors";
import {
  createRedirectRepository,
  type RedirectRepository,
  type RedirectRepositoryClient,
} from "./repository";

type AuthorizeRedirectMutation = () => Promise<AuthenticatedUser>;

export type RedirectServiceDependencies = {
  authorize?: AuthorizeRedirectMutation;
  repository?: RedirectRepository;
  repositoryFactory?: () => Promise<RedirectRepository>;
};

const CONTENT_ROUTE_PATTERN =
  /^\/(garden|forest|lake|ruins)\/[a-z0-9]+(?:-[a-z0-9]+)*$/;
const redirectTypes = new Set<RedirectType>(REDIRECT_TYPES);

function assertRoute(
  route: string,
  field: "source" | "target",
): void {
  if (!CONTENT_ROUTE_PATTERN.test(route)) {
    throw new RedirectError(
      field === "source" ? "invalid_source_route" : "invalid_target_route",
    );
  }
}

function normalizeCommand(
  command: CreateRedirectCommand,
): CreateRedirectCommand {
  assertRoute(command.sourceRoute, "source");
  assertRoute(command.targetRoute, "target");

  if (!redirectTypes.has(command.type)) {
    throw new RedirectError("invalid_redirect_type");
  }

  if (command.sourceRoute === command.targetRoute) {
    throw new RedirectError("self_redirect");
  }

  if (
    command.reason !== undefined &&
    command.reason !== null &&
    typeof command.reason !== "string"
  ) {
    throw new RedirectError("invalid_redirect_reason");
  }

  const reason = command.reason?.trim() || null;
  if (reason && reason.length > 500) {
    throw new RedirectError("invalid_redirect_reason");
  }

  return { ...command, reason };
}

async function createDefaultRepository(): Promise<RedirectRepository> {
  const client = await createClient();
  return createRedirectRepository(
    client as unknown as RedirectRepositoryClient,
  );
}

export function createRedirectService(
  dependencies: RedirectServiceDependencies = {},
): RedirectService {
  const authorize = dependencies.authorize ?? requireGardenKeeper;
  let repositoryPromise: Promise<RedirectRepository> | null =
    dependencies.repository ? Promise.resolve(dependencies.repository) : null;

  function getRepository(): Promise<RedirectRepository> {
    repositoryPromise ??=
      dependencies.repositoryFactory?.() ?? createDefaultRepository();
    return repositoryPromise;
  }

  async function createRedirect(
    command: CreateRedirectCommand,
  ): Promise<RouteRedirect> {
    await authorize();
    return (await getRepository()).createRedirect(normalizeCommand(command));
  }

  return { createRedirect };
}
