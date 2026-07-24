import "server-only";

import type { AuthenticatedUser } from "@/lib/auth";
import { requireGardenKeeper } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

import type {
  AdminContentListItem,
  AdminContentListRecord,
  AdminContentManagementService,
} from "./content-management-contracts";
import {
  ContentManagementRepositoryError,
  createContentManagementReadRepository,
  type ContentManagementReadRepository,
  type ContentManagementRepositoryClient,
} from "./content-management-repository";

type AuthorizeContentManagementRequest = () => Promise<AuthenticatedUser>;

export class ContentManagementUnavailableError extends Error {
  constructor() {
    super("The content workbench is temporarily unavailable.");
    this.name = "ContentManagementUnavailableError";
  }
}

export type AdminContentManagementServiceDependencies = {
  authorize?: AuthorizeContentManagementRequest;
  repository?: ContentManagementReadRepository;
  repositoryFactory?: () => Promise<ContentManagementReadRepository>;
};

function preferredTitle(
  titleEn: string | null,
  titleZh: string | null,
): string {
  return titleEn?.trim() || titleZh?.trim() || "Untitled Draft";
}

export function mapAdminContentListItem(
  record: AdminContentListRecord,
): AdminContentListItem {
  const revision = record.activeRevision;
  const lifecycle =
    record.lifecycle === "Draft" && revision?.lifecycle === "Review"
      ? "Review"
      : record.lifecycle;

  return {
    contentId: record.contentId,
    title: preferredTitle(
      revision?.titleEn ?? record.titleEn,
      revision?.titleZh ?? record.titleZh,
    ),
    region: revision?.region ?? record.region,
    lifecycle,
    projectionLifecycle: record.lifecycle,
    growthStage: revision ? revision.growthStage : record.growthStage,
    updatedAt: revision?.updatedAt ?? record.updatedAt,
    revisionId: revision?.revisionId ?? null,
    revisionLifecycle: revision?.lifecycle ?? null,
    lockVersion: revision?.lockVersion ?? null,
  };
}

async function createDefaultRepository(): Promise<ContentManagementReadRepository> {
  try {
    const client = await createClient();
    return createContentManagementReadRepository(
      client as unknown as ContentManagementRepositoryClient,
    );
  } catch {
    throw new ContentManagementUnavailableError();
  }
}

export function createAdminContentManagementService(
  dependencies: AdminContentManagementServiceDependencies = {},
): AdminContentManagementService {
  const authorize = dependencies.authorize ?? requireGardenKeeper;
  let repositoryPromise: Promise<ContentManagementReadRepository> | null =
    dependencies.repository ? Promise.resolve(dependencies.repository) : null;

  function getRepository(): Promise<ContentManagementReadRepository> {
    repositoryPromise ??=
      dependencies.repositoryFactory?.() ?? createDefaultRepository();
    return repositoryPromise;
  }

  async function listContent(): Promise<AdminContentListItem[]> {
    await authorize();

    try {
      const records = await (await getRepository()).listContentRecords();
      return records
        .map(mapAdminContentListItem)
        .sort(
          (left, right) =>
            Date.parse(right.updatedAt) - Date.parse(left.updatedAt),
        );
    } catch (error) {
      if (error instanceof ContentManagementUnavailableError) throw error;
      if (error instanceof ContentManagementRepositoryError) {
        throw new ContentManagementUnavailableError();
      }

      throw new ContentManagementUnavailableError();
    }
  }

  return { listContent };
}

let defaultContentManagementService: AdminContentManagementService | null =
  null;

function getDefaultContentManagementService(): AdminContentManagementService {
  defaultContentManagementService ??= createAdminContentManagementService();
  return defaultContentManagementService;
}

export function listAdminContent(): Promise<AdminContentListItem[]> {
  return getDefaultContentManagementService().listContent();
}
