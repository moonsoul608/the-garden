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
import { contentLanguageLabels, detailLevelLabels } from "../admin-labels";

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
  { value: "en", label: contentLanguageLabels.en },
  { value: "zh", label: contentLanguageLabels.zh },
  { value: "bilingual", label: contentLanguageLabels.bilingual },
  { value: "mixed", label: contentLanguageLabels.mixed },
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
      {pending ? "保存中…" : label}
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

      <section className="admin-editor-section" aria-labelledby="identity-fields">
        <div className="admin-editor-section-heading">
          <p>01</p>
          <div>
            <h2 id="identity-fields">身份与位置</h2>
            <span>先确认草稿的基本位置，再编辑内容详情。</span>
          </div>
        </div>

        <div className="admin-form-grid admin-form-grid--two">
          <label className="admin-form-field">
            <span>英文标题</span>
            <input
              name="titleEn"
              type="text"
              defaultValue={draft?.titleEn ?? ""}
              aria-describedby={titleErrors ? "title-error" : undefined}
            />
          </label>
          <label className="admin-form-field">
            <span>中文标题</span>
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
            <small id="slug-hint">草稿阶段可选。请使用小写 kebab-case。</small>
          </label>
          <label className="admin-form-field">
            <span>语言模式</span>
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
            <span>区域</span>
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
            <span>内容类型</span>
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
            <span>详细程度</span>
            <select
              name="detailLevel"
              defaultValue={draft?.detailLevel ?? "short"}
            >
              {DETAIL_LEVELS.map((detailLevel) => (
                <option key={detailLevel} value={detailLevel}>
                  {detailLevelLabels[detailLevel]}
                </option>
              ))}
            </select>
          </label>
          <label className="admin-form-field">
            <span>Growth Stage{growthStageRequired ? "" : "（可选）"}</span>
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
                <option value="">不跟踪 Growth Stage</option>
              ) : null}
              {GROWTH_STAGES.map((growthStage) => (
                <option key={growthStage}>{growthStage}</option>
              ))}
            </select>
            {!growthStageRequired ? (
              <small id="growth-stage-hint">
                Lake Reflections 可以不启用 Growth Stage 跟踪。
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
            <h2 id="content-fields">结构化内容</h2>
            <span>当前仅提供纯文本字段。富文本编辑和预览将在后续阶段处理。</span>
          </div>
        </div>

        <div className="admin-form-grid admin-form-grid--two">
          <label className="admin-form-field">
            <span>英文摘要</span>
            <textarea
              name="summaryEn"
              rows={4}
              defaultValue={draft?.summaryEn ?? ""}
              aria-describedby={summaryErrors ? "summary-error" : undefined}
            />
          </label>
          <label className="admin-form-field">
            <span>中文摘要</span>
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
            <span>英文正文</span>
            <textarea
              name="bodyEnMarkdown"
              rows={12}
              defaultValue={draft?.bodyEnMarkdown ?? ""}
              aria-describedby={bodyErrors ? "body-error" : undefined}
            />
          </label>
          <label className="admin-form-field">
            <span>中文正文</span>
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
            <h2 id="taxonomy-fields">分类</h2>
            <span>请使用英文逗号分隔多个值；最终以服务端校验为准。</span>
          </div>
        </div>

        <div className="admin-form-grid admin-form-grid--two">
          <label className="admin-form-field">
            <span>主分类</span>
            <input
              name="primaryCategories"
              type="text"
              placeholder="Psychology, Coding"
              defaultValue={draft?.primaryCategories.join(", ") ?? ""}
              aria-describedby={
                categoryErrors ? "category-error" : "category-hint"
              }
            />
            <small id="category-hint">提交审核前会校验固定分类。</small>
          </label>
          <label className="admin-form-field">
            <span>标签</span>
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
        <div className="admin-editor-action-row">
          <SubmitButton
            label={mode === "create" ? "创建草稿" : "保存更改"}
            conflict={state.status === "conflict"}
          />
          <Link href="/admin/content">返回内容管理</Link>
          {state.status === "success" && state.updatedAt ? (
            <time dateTime={state.updatedAt}>
              已保存 {new Date(state.updatedAt).toLocaleString()}
            </time>
          ) : null}
        </div>
        {state.message ? (
          <div
            className={`admin-form-notice admin-form-notice--${state.status}`}
            role={state.status === "success" ? "status" : "alert"}
            aria-live={state.status === "success" ? "polite" : "assertive"}
            tabIndex={state.status === "success" ? undefined : -1}
          >
            <strong>{state.status === "success" ? "已保存" : "保存失败"}</strong>
            <span>{state.message}</span>
            {state.status === "conflict" && draft ? (
              <Link href={`/admin/content/${draft.revisionId}`}>重新加载草稿</Link>
            ) : null}
          </div>
        ) : null}
      </div>
    </form>
  );
}
