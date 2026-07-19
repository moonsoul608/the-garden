import "server-only";

import type { AuthenticatedUser } from "@/lib/auth";
import { requireGardenKeeper } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

import type { AdminContentService } from "./contracts";
import {
  type CoverReplacementReceipt,
  type MediaDraftTarget,
  type MediaObjectItem,
  type MediaObjectRecord,
  type MediaReferenceStatus,
  type MediaWorkspace,
  type MediaWorkspaceService,
  type ReplaceDraftCoverInput,
} from "./media-contracts";
import {
  createMediaRepository,
  MediaRepositoryError,
  type MediaRepository,
  type MediaRepositoryClient,
} from "./media-repository";
import {
  coverExtensionForType,
  validateCoverUpload,
} from "./media-validation";
import { createAdminContentService } from "./service";

type AuthorizeMediaRequest = () => Promise<AuthenticatedUser>;
type MediaDraftService = Pick<
  AdminContentService,
  "getDraftById" | "listDrafts" | "updateDraft"
>;

export class MediaWorkspaceUnavailableError extends Error {
  constructor() {
    super("The media workspace is temporarily unavailable.");
    this.name = "MediaWorkspaceUnavailableError";
  }
}

export class MediaDraftUnavailableError extends Error {
  constructor() {
    super("This Draft is no longer available for a cover replacement.");
    this.name = "MediaDraftUnavailableError";
  }
}

export class MediaReferenceUpdateError extends Error {
  constructor() {
    super(
      "The cover was uploaded but could not be attached. It remains unreferenced and was not deleted.",
    );
    this.name = "MediaReferenceUpdateError";
  }
}

export type MediaWorkspaceServiceDependencies = {
  authorize?: AuthorizeMediaRequest;
  repository?: MediaRepository;
  repositoryFactory?: () => Promise<MediaRepository>;
  draftService?: MediaDraftService;
  createObjectId?: () => string;
};

export function mapMediaReferenceStatus(
  record: Pick<MediaObjectRecord, "lifecycleState" | "referenceCount">,
): MediaReferenceStatus {
  if (record.referenceCount > 0 || record.lifecycleState === "Referenced") {
    return "Referenced";
  }
  if (
    record.lifecycleState === "Quarantine" ||
    record.lifecycleState === "EligibleForPurge"
  ) {
    return "QuarantineCandidate";
  }
  return "Unreferenced";
}

export function mapMediaObjectItem(record: MediaObjectRecord): MediaObjectItem {
  const parts = record.objectPath.split("/").filter(Boolean);
  return {
    ...record,
    displayName: parts.at(-1) ?? record.objectPath,
    referenceStatus: mapMediaReferenceStatus(record),
  };
}

function preferredTitle(titleEn: string | null, titleZh: string | null): string {
  return titleEn?.trim() || titleZh?.trim() || "Untitled Draft";
}

async function createDefaultRepository(): Promise<MediaRepository> {
  const client = await createClient();
  return createMediaRepository(client as unknown as MediaRepositoryClient);
}

export function createMediaWorkspaceService(
  dependencies: MediaWorkspaceServiceDependencies = {},
): MediaWorkspaceService {
  const authorize = dependencies.authorize ?? requireGardenKeeper;
  const draftService = dependencies.draftService ?? createAdminContentService();
  const createObjectId =
    dependencies.createObjectId ?? (() => crypto.randomUUID());
  let repositoryPromise: Promise<MediaRepository> | null = dependencies.repository
    ? Promise.resolve(dependencies.repository)
    : null;

  function getRepository(): Promise<MediaRepository> {
    repositoryPromise ??=
      dependencies.repositoryFactory?.() ?? createDefaultRepository();
    return repositoryPromise;
  }

  async function getWorkspace(): Promise<MediaWorkspace> {
    await authorize();

    try {
      const [records, drafts] = await Promise.all([
        (await getRepository()).listMediaObjects(),
        draftService.listDrafts(),
      ]);
      const draftTargets: MediaDraftTarget[] = drafts.map((draft) => ({
        contentId: draft.contentId,
        revisionId: draft.revisionId,
        lockVersion: draft.lockVersion,
        title: preferredTitle(draft.titleEn, draft.titleZh),
        currentCoverPath: draft.cover?.path ?? null,
      }));

      return {
        media: records
          .map(mapMediaObjectItem)
          .sort((left, right) =>
            (right.updatedAt ?? "").localeCompare(left.updatedAt ?? ""),
          ),
        draftTargets,
      };
    } catch (error) {
      if (error instanceof MediaWorkspaceUnavailableError) throw error;
      console.error("media workspace getWorkspace failed", error);
      throw new MediaWorkspaceUnavailableError();
    }
  }

  async function replaceDraftCover(
    input: ReplaceDraftCoverInput,
  ): Promise<CoverReplacementReceipt> {
    await authorize();
    const mediaType = validateCoverUpload(input);
    const extension = coverExtensionForType(mediaType);
    if (!extension) throw new MediaWorkspaceUnavailableError();

    const current = await draftService.getDraftById(input.revisionId);
    if (!current || current.contentId !== input.contentId) {
      throw new MediaDraftUnavailableError();
    }
    if (current.lockVersion !== input.expectedLockVersion) {
      throw new MediaDraftUnavailableError();
    }

    const objectPath = `contents/${input.contentId}/${createObjectId()}.${extension}`;
    try {
      await (await getRepository()).uploadCover({
        objectPath,
        file: input.file,
        contentType: mediaType,
      });
    } catch (error) {
      if (error instanceof MediaRepositoryError) {
        throw new MediaWorkspaceUnavailableError();
      }
      throw error;
    }

    try {
      const updated = await draftService.updateDraft({
        contentId: input.contentId,
        revisionId: input.revisionId,
        expectedLockVersion: input.expectedLockVersion,
        changes: {
          cover: {
            path: objectPath,
            altZh: current.cover?.altZh ?? null,
            altEn: current.cover?.altEn ?? null,
          },
        },
      });

      return {
        contentId: updated.contentId,
        revisionId: updated.revisionId,
        previousObjectPath: current.cover?.path ?? null,
        objectPath,
        lockVersion: updated.lockVersion,
        updatedAt: updated.updatedAt,
      };
    } catch {
      // The upload is intentionally preserved. It will appear as unreferenced;
      // this workspace has no Storage delete or purge capability.
      throw new MediaReferenceUpdateError();
    }
  }

  return { getWorkspace, replaceDraftCover };
}
