"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { requiresGrowthStage } from "@/lib/content/validation";

import type {
  ContentLanguage,
  ContentType,
  DetailLevel,
  GrowthStage,
  RegionName,
} from "@/types";

import type { ContentFormState } from "./form-contracts";
import { INITIAL_CONTENT_FORM_STATE } from "./form-contracts";

type EditableDraft = Readonly<{
  contentId: string;
  revisionId: string;
  lockVersion: number;
  slug: string | null;
  region: RegionName;
  contentType: ContentType;
  detailLevel: DetailLevel;
  growthStage: GrowthStage | null;
  titleZh: string | null;
  titleEn: string | null;
  summaryZh: string | null;
  summaryEn: string | null;
  bodyZhMarkdown: string | null;
  bodyEnMarkdown: string | null;
  contentLanguage: ContentLanguage;
  primaryCategories: readonly string[];
  tags: readonly string[];
}>;

type ContentFormProps = Readonly<{
  mode: "create" | "edit";
  action: (
    state: ContentFormState,
    formData: FormData,
  ) => Promise<ContentFormState>;
  draft?: EditableDraft;
}>;

const REGIONS = ["Garden", "Forest", "Lake", "Ruins"] as const;
const CONTENT_TYPES = ["Seed", "Question", "Reflection", "Trace"] as const;
const DETAIL_LEVELS = ["short", "full"] as const;
const GROWTH_STAGES = [
  "Seed",
  "Sprout",
  "Growing",
  "Bloom",
  "Dormant",
] as const;

const LANGUAGE_OPTIONS: ReadonlyArray<{
  value: ContentLanguage;
  label: string;
}> = [
  { value: "en", label: "English" },
  { value: "zh", label: "Chinese" },
  { value: "bilingual", label: "Bilingual" },
  { value: "mixed", label: "Mixed language" },
];

function SubmitButton({
  label,
  conflict,
}: Readonly<{ label: string; conflict: boolean }>) {
  const { pending } = useFormStatus();

  return (
    <button
      className="admin-primary-action"
      type="submit"
      disabled={pending || conflict}
    >
      {pending ? "Saving…" : label}
    </button>
  );
}

function FieldError({
  errors,
  id,
}: Readonly<{ errors?: readonly string[]; id: string }>) {
  if (!errors?.length) return null;

  return (
    <span className="admin-field-error" id={id}>
      {errors.join(" ")}
    </span>
  );
}

export function ContentForm({ mode, action, draft }: ContentFormProps) {
  const [state, formAction] = useActionState(
    action,
    INITIAL_CONTENT_FORM_STATE,
  );
  const titleErrors = state.fieldErrors.title;
  const slugErrors = state.fieldErrors.slug;
  const summaryErrors = state.fieldErrors.summary;
  const bodyErrors = state.fieldErrors.bodyMarkdown;
  const categoryErrors = state.fieldErrors.primaryCategories;
  const tagErrors = state.fieldErrors.tags;
  const growthStageErrors = state.fieldErrors.growthStage;
  const [region, setRegion] = useState<RegionName>(draft?.region ?? "Garden");
  const [contentType, setContentType] = useState<ContentType>(
    draft?.contentType ?? "Seed",
  );
  const [growthStage, setGrowthStage] = useState<GrowthStage | null>(
    draft ? draft.growthStage : "Seed",
  );
  const growthStageRequired = requiresGrowthStage(region, contentType);

  function updatePlacement(
    nextRegion: RegionName,
    nextContentType: ContentType,
  ) {
    setRegion(nextRegion);
    setContentType(nextContentType);
    if (!requiresGrowthStage(nextRegion, nextContentType)) {
      setGrowthStage(null);
    } else if (growthStage === null) {
      setGrowthStage("Seed");
    }
  }
  const lockVersion =
    state.status === "success" && state.lockVersion
      ? state.lockVersion
      : draft?.lockVersion;

  return (
    <form className="admin-editor-form" action={formAction}>
      {draft ? (
        <>
          <input type="hidden" name="contentId" value={draft.contentId} />
          <input type="hidden" name="revisionId" value={draft.revisionId} />
          <input
            type="hidden"
            name="expectedLockVersion"
            value={lockVersion}
          />
        </>
      ) : null}

      {state.message ? (
        <div
          className={`admin-form-notice admin-form-notice--${state.status}`}
          role={state.status === "success" ? "status" : "alert"}
          aria-live="polite"
        >
          <strong>{state.status === "success" ? "Saved" : "Save paused"}</strong>
          <span>{state.message}</span>
          {state.status === "conflict" && draft ? (
            <Link href={`/admin/content/${draft.revisionId}`}>Reload Draft</Link>
          ) : null}
        </div>
      ) : null}

      <section className="admin-editor-section" aria-labelledby="identity-fields">
        <div className="admin-editor-section-heading">
          <p>01</p>
          <div>
            <h2 id="identity-fields">Identity and placement</h2>
            <span>Give the Draft a clear place before tending its details.</span>
          </div>
        </div>

        <div className="admin-form-grid admin-form-grid--two">
          <label className="admin-form-field">
            <span>English title</span>
            <input
              name="titleEn"
              type="text"
              defaultValue={draft?.titleEn ?? ""}
              aria-describedby={titleErrors ? "title-error" : undefined}
            />
          </label>
          <label className="admin-form-field">
            <span>Chinese title</span>
            <input
              name="titleZh"
              type="text"
              lang="zh"
              defaultValue={draft?.titleZh ?? ""}
              aria-describedby={titleErrors ? "title-error" : undefined}
            />
          </label>
        </div>
        <FieldError errors={titleErrors} id="title-error" />

        <div className="admin-form-grid admin-form-grid--two">
          <label className="admin-form-field">
            <span>Slug</span>
            <input
              name="slug"
              type="text"
              inputMode="url"
              placeholder="a-quiet-path"
              defaultValue={draft?.slug ?? ""}
              aria-describedby={slugErrors ? "slug-error" : "slug-hint"}
            />
            <small id="slug-hint">Optional in Draft. Use lowercase kebab-case.</small>
          </label>
          <label className="admin-form-field">
            <span>Language mode</span>
            <select
              name="contentLanguage"
              defaultValue={draft?.contentLanguage ?? "en"}
            >
              {LANGUAGE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <FieldError errors={slugErrors} id="slug-error" />

        <div className="admin-form-grid admin-form-grid--four">
          <label className="admin-form-field">
            <span>Region</span>
            <select
              name="region"
              value={region}
              onChange={(event) =>
                updatePlacement(event.target.value as RegionName, contentType)
              }
            >
              {REGIONS.map((region) => (
                <option key={region}>{region}</option>
              ))}
            </select>
          </label>
          <label className="admin-form-field">
            <span>Content type</span>
            <select
              name="contentType"
              value={contentType}
              onChange={(event) =>
                updatePlacement(region, event.target.value as ContentType)
              }
            >
              {CONTENT_TYPES.map((contentType) => (
                <option key={contentType}>{contentType}</option>
              ))}
            </select>
          </label>
          <label className="admin-form-field">
            <span>Detail level</span>
            <select
              name="detailLevel"
              defaultValue={draft?.detailLevel ?? "short"}
            >
              {DETAIL_LEVELS.map((detailLevel) => (
                <option key={detailLevel}>{detailLevel}</option>
              ))}
            </select>
          </label>
          <label className="admin-form-field">
            <span>Growth stage{growthStageRequired ? "" : " (optional)"}</span>
            <select
              name="growthStage"
              value={growthStage ?? ""}
              onChange={(event) =>
                setGrowthStage(
                  event.target.value
                    ? (event.target.value as GrowthStage)
                    : null,
                )
              }
              aria-describedby={
                growthStageErrors ? "growth-stage-error" : "growth-stage-hint"
              }
            >
              {!growthStageRequired ? (
                <option value="">Not growth-tracked</option>
              ) : null}
              {GROWTH_STAGES.map((growthStage) => (
                <option key={growthStage}>{growthStage}</option>
              ))}
            </select>
            {!growthStageRequired ? (
              <small id="growth-stage-hint">
                Lake Reflections may remain outside growth tracking.
              </small>
            ) : null}
          </label>
        </div>
        <FieldError errors={growthStageErrors} id="growth-stage-error" />
      </section>

      <section className="admin-editor-section" aria-labelledby="content-fields">
        <div className="admin-editor-section-heading">
          <p>02</p>
          <div>
            <h2 id="content-fields">Structured content</h2>
            <span>Plain fields only. Rich editing and preview belong to a later phase.</span>
          </div>
        </div>

        <div className="admin-form-grid admin-form-grid--two">
          <label className="admin-form-field">
            <span>English summary</span>
            <textarea
              name="summaryEn"
              rows={4}
              defaultValue={draft?.summaryEn ?? ""}
              aria-describedby={summaryErrors ? "summary-error" : undefined}
            />
          </label>
          <label className="admin-form-field">
            <span>Chinese summary</span>
            <textarea
              name="summaryZh"
              rows={4}
              lang="zh"
              defaultValue={draft?.summaryZh ?? ""}
              aria-describedby={summaryErrors ? "summary-error" : undefined}
            />
          </label>
        </div>
        <FieldError errors={summaryErrors} id="summary-error" />

        <div className="admin-form-grid admin-form-grid--two">
          <label className="admin-form-field">
            <span>English body</span>
            <textarea
              name="bodyEnMarkdown"
              rows={12}
              defaultValue={draft?.bodyEnMarkdown ?? ""}
              aria-describedby={bodyErrors ? "body-error" : undefined}
            />
          </label>
          <label className="admin-form-field">
            <span>Chinese body</span>
            <textarea
              name="bodyZhMarkdown"
              rows={12}
              lang="zh"
              defaultValue={draft?.bodyZhMarkdown ?? ""}
              aria-describedby={bodyErrors ? "body-error" : undefined}
            />
          </label>
        </div>
        <FieldError errors={bodyErrors} id="body-error" />
      </section>

      <section className="admin-editor-section" aria-labelledby="taxonomy-fields">
        <div className="admin-editor-section-heading">
          <p>03</p>
          <div>
            <h2 id="taxonomy-fields">Taxonomy</h2>
            <span>Use comma-separated values; service validation remains authoritative.</span>
          </div>
        </div>

        <div className="admin-form-grid admin-form-grid--two">
          <label className="admin-form-field">
            <span>Primary categories</span>
            <input
              name="primaryCategories"
              type="text"
              placeholder="Psychology, Coding"
              defaultValue={draft?.primaryCategories.join(", ") ?? ""}
              aria-describedby={
                categoryErrors ? "category-error" : "category-hint"
              }
            />
            <small id="category-hint">Fixed category validation runs before Review.</small>
          </label>
          <label className="admin-form-field">
            <span>Tags</span>
            <input
              name="tags"
              type="text"
              placeholder="notes, learning"
              defaultValue={draft?.tags.join(", ") ?? ""}
              aria-describedby={tagErrors ? "tag-error" : undefined}
            />
          </label>
        </div>
        <FieldError errors={categoryErrors} id="category-error" />
        <FieldError errors={tagErrors} id="tag-error" />
      </section>

      <div className="admin-editor-actions">
        <SubmitButton
          label={mode === "create" ? "Create Draft" : "Save changes"}
          conflict={state.status === "conflict"}
        />
        <Link href="/admin/content">Return to content</Link>
        {state.status === "success" && state.updatedAt ? (
          <time dateTime={state.updatedAt}>
            Saved {new Date(state.updatedAt).toLocaleString()}
          </time>
        ) : null}
      </div>
    </form>
  );
}
