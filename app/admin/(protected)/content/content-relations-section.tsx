"use client";

import { useActionState } from "react";

import type {
  ContentRelationListItem,
  ContentRelationTargetOption,
} from "@/lib/content/admin";
import type { RelationType } from "@/types";

import {
  createContentRelationAction,
  deleteContentRelationAction,
} from "./content-relation-actions";
import {
  INITIAL_CONTENT_RELATION_ACTION_STATE,
  type ContentRelationActionState,
} from "./content-relation-action-contracts";

const RELATION_TYPES = [
  { value: "grewInto", label: "成长为" },
  { value: "grewFrom", label: "源自" },
  { value: "relatedTo", label: "相关" },
] as const satisfies ReadonlyArray<{ value: RelationType; label: string }>;

function relationLabel(relationType: RelationType): string {
  return (
    RELATION_TYPES.find((relation) => relation.value === relationType)?.label ??
    relationType
  );
}

function FieldError({
  state,
  field,
}: Readonly<{ state: ContentRelationActionState; field: string }>) {
  const errors = state.fieldErrors[field];
  if (!errors?.length) return null;

  return (
    <span className="admin-field-error" id={`content-relation-${field}-error`}>
      {errors.join(" ")}
    </span>
  );
}

function ActionNotice({
  state,
}: Readonly<{ state: ContentRelationActionState }>) {
  if (state.status === "idle" || !state.message) return null;

  return (
    <p
      className={`admin-growth-note-status admin-growth-note-status--${state.status}`}
      role={state.status === "success" ? "status" : "alert"}
    >
      {state.message}
    </p>
  );
}

function HiddenIdentity({
  sourceContentId,
  revisionId,
  relationId,
}: Readonly<{
  sourceContentId: string;
  revisionId: string;
  relationId?: string;
}>) {
  return (
    <>
      <input type="hidden" name="sourceContentId" value={sourceContentId} />
      <input type="hidden" name="revisionId" value={revisionId} />
      {relationId ? (
        <input type="hidden" name="relationId" value={relationId} />
      ) : null}
    </>
  );
}

function CreateRelationForm({
  sourceContentId,
  revisionId,
  targets,
}: Readonly<{
  sourceContentId: string;
  revisionId: string;
  targets: readonly ContentRelationTargetOption[];
}>) {
  const [state, action, pending] = useActionState(
    createContentRelationAction,
    INITIAL_CONTENT_RELATION_ACTION_STATE,
  );
  const hasTargets = targets.length > 0;

  return (
    <form className="admin-growth-note-form" action={action}>
      <HiddenIdentity sourceContentId={sourceContentId} revisionId={revisionId} />
      <div className="admin-form-grid admin-form-grid--two">
        <label className="admin-form-field">
          <span>目标内容</span>
          <select
            name="targetContentId"
            defaultValue=""
            disabled={!hasTargets}
            aria-describedby={
              state.fieldErrors.targetContentId
                ? "content-relation-targetContentId-error"
                : undefined
            }
          >
            <option value="" disabled>
              选择内容
            </option>
            {targets.map((target) => (
              <option key={target.id} value={target.id}>
                {target.label}
              </option>
            ))}
          </select>
        </label>
        <label className="admin-form-field">
          <span>关系类型</span>
          <select
            name="relationType"
            defaultValue="relatedTo"
            aria-describedby={
              state.fieldErrors.relationType
                ? "content-relation-relationType-error"
                : undefined
            }
          >
            {RELATION_TYPES.map((relation) => (
              <option key={relation.value} value={relation.value}>
                {relation.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <FieldError state={state} field="targetContentId" />
      <FieldError state={state} field="relationType" />

      <div className="admin-form-grid admin-form-grid--two">
        <label className="admin-form-field">
          <span>中文备注</span>
          <textarea name="noteZh" rows={3} lang="zh" />
        </label>
        <label className="admin-form-field">
          <span>英文备注</span>
          <textarea name="noteEn" rows={3} />
        </label>
      </div>

      <div className="admin-growth-note-actions">
        <button
          className="admin-primary-action"
          type="submit"
          disabled={pending || !hasTargets}
        >
          {pending ? "创建中..." : "创建 Content Relations"}
        </button>
        <ActionNotice state={state} />
      </div>
    </form>
  );
}

function ExistingRelation({
  sourceContentId,
  revisionId,
  relation,
}: Readonly<{
  sourceContentId: string;
  revisionId: string;
  relation: ContentRelationListItem;
}>) {
  const [state, action, pending] = useActionState(
    deleteContentRelationAction,
    INITIAL_CONTENT_RELATION_ACTION_STATE,
  );
  const targetLabel = relation.target?.label ?? relation.targetContentId;

  return (
    <article className="admin-growth-note-card admin-content-relation-card">
      <div className="admin-content-relation-summary">
        <p>{relationLabel(relation.relationType)}</p>
        <h3>{targetLabel}</h3>
        {relation.noteEn || relation.noteZh ? (
          <div className="admin-content-relation-notes">
            {relation.noteEn ? <p>{relation.noteEn}</p> : null}
            {relation.noteZh ? <p lang="zh">{relation.noteZh}</p> : null}
          </div>
        ) : null}
      </div>
      <form className="admin-growth-note-delete" action={action}>
        <HiddenIdentity
          sourceContentId={sourceContentId}
          revisionId={revisionId}
          relationId={relation.id}
        />
        <button
          className="admin-destructive-action"
          type="submit"
          disabled={pending}
        >
          {pending ? "删除中..." : "删除"}
        </button>
        <ActionNotice state={state} />
      </form>
    </article>
  );
}

export function ContentRelationsSection({
  sourceContentId,
  revisionId,
  relations,
  targets,
}: Readonly<{
  sourceContentId: string;
  revisionId: string;
  relations: readonly ContentRelationListItem[];
  targets: readonly ContentRelationTargetOption[];
}>) {
  return (
    <section
      className="admin-editor-section admin-content-relations-section"
      aria-labelledby="content-relations-title"
    >
      <div className="admin-editor-section-heading">
        <p>05</p>
        <div>
          <h2 id="content-relations-title">Content Relations</h2>
          <span>管理公开关联渲染所需的源内容到目标内容链接。</span>
        </div>
      </div>

      <div className="admin-growth-notes-workspace">
        <CreateRelationForm
          sourceContentId={sourceContentId}
          revisionId={revisionId}
          targets={targets}
        />

        {relations.length > 0 ? (
          <div className="admin-growth-note-list">
            {relations.map((relation) => (
              <ExistingRelation
                key={relation.id}
                sourceContentId={sourceContentId}
                revisionId={revisionId}
                relation={relation}
              />
            ))}
          </div>
        ) : (
          <p className="admin-growth-note-empty">
            还没有出站 Content Relations。
          </p>
        )}
      </div>
    </section>
  );
}
