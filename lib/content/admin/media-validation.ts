import "server-only";

import {
  ALLOWED_COVER_MEDIA_TYPES,
  MAX_COVER_UPLOAD_BYTES,
  type AllowedCoverMediaType,
} from "./media-contracts";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MIME_TYPE_EXTENSIONS: Record<AllowedCoverMediaType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export type MediaValidationErrorCode =
  | "invalid_identity"
  | "invalid_concurrency_token"
  | "missing_file"
  | "invalid_file_name"
  | "empty_file"
  | "file_too_large"
  | "unsupported_file_type";

export class MediaValidationError extends Error {
  constructor(readonly code: MediaValidationErrorCode) {
    super(
      code === "file_too_large"
        ? "封面文件必须不超过 5 MiB。"
        : code === "unsupported_file_type"
          ? "请选择 JPEG、PNG 或 WebP 封面。"
          : code === "empty_file" || code === "missing_file"
            ? "上传前请选择封面文件。"
            : "封面上传信息无效。",
    );
    this.name = "MediaValidationError";
  }
}

export function isMediaUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

export function coverExtensionForType(type: string): string | null {
  return ALLOWED_COVER_MEDIA_TYPES.includes(type as AllowedCoverMediaType)
    ? MIME_TYPE_EXTENSIONS[type as AllowedCoverMediaType]
    : null;
}

export function validateCoverUpload(input: {
  contentId: string;
  revisionId: string;
  expectedLockVersion: number;
  file: File;
}): AllowedCoverMediaType {
  if (!isMediaUuid(input.contentId) || !isMediaUuid(input.revisionId)) {
    throw new MediaValidationError("invalid_identity");
  }
  if (
    !Number.isSafeInteger(input.expectedLockVersion) ||
    input.expectedLockVersion < 1
  ) {
    throw new MediaValidationError("invalid_concurrency_token");
  }
  if (!input.file || typeof input.file.name !== "string") {
    throw new MediaValidationError("missing_file");
  }
  if (
    !input.file.name.trim() ||
    input.file.name.length > 160 ||
    /[\\/\0]/.test(input.file.name)
  ) {
    throw new MediaValidationError("invalid_file_name");
  }
  if (!Number.isSafeInteger(input.file.size) || input.file.size <= 0) {
    throw new MediaValidationError("empty_file");
  }
  if (input.file.size > MAX_COVER_UPLOAD_BYTES) {
    throw new MediaValidationError("file_too_large");
  }
  if (!coverExtensionForType(input.file.type)) {
    throw new MediaValidationError("unsupported_file_type");
  }

  return input.file.type as AllowedCoverMediaType;
}

