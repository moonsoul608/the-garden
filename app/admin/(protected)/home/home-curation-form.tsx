"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import type {
  HomeCurationContentOption,
  HomeCurationSlotItem,
} from "@/lib/content/admin";
import type { HomeCurationSlot } from "@/types";

import { saveHomeCurationAction } from "./actions";
import { INITIAL_HOME_CURATION_ACTION_STATE } from "./action-contracts";

type HomeCurationFormProps = Readonly<{
  currentlyGrowing: readonly HomeCurationSlotItem[];
  recentlyPlanted: readonly HomeCurationSlotItem[];
  options: readonly HomeCurationContentOption[];
}>;

type SlotConfig = Readonly<{
  slot: HomeCurationSlot;
  title: string;
  description: string;
}>;

const SLOT_CONFIGS: readonly SlotConfig[] = [
  {
    slot: "currentlyGrowing",
    title: "Currently Growing",
    description: "当前显示在首页的重点内容。",
  },
  {
    slot: "recentlyPlanted",
    title: "Recently Planted",
    description: "显示在首页下方的最新内容。",
  },
];

function optionLabel(option: HomeCurationContentOption): string {
  return [
    option.title,
    option.region,
    option.growthStage ?? "不跟踪 Growth Stage",
  ].join(" - ");
}

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button className="admin-primary-action" type="submit" disabled={pending}>
      {pending ? "保存中..." : "保存首页精选"}
    </button>
  );
}

function Notice({
  state,
}: Readonly<{ state: typeof INITIAL_HOME_CURATION_ACTION_STATE }>) {
  if (state.status === "idle" || !state.message) return null;

  return (
    <div
      className={`admin-form-notice admin-form-notice--${state.status}`}
      role={state.status === "success" ? "status" : "alert"}
      aria-live="polite"
    >
      <strong>{state.status === "success" ? "已保存" : "保存暂停"}</strong>
      <span>{state.message}</span>
    </div>
  );
}

function SlotRows({
  config,
  values,
  options,
  onChange,
  onAdd,
  onRemove,
}: Readonly<{
  config: SlotConfig;
  values: readonly string[];
  options: readonly HomeCurationContentOption[];
  onChange: (index: number, value: string) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
}>) {
  return (
    <section className="admin-home-slot" aria-labelledby={`${config.slot}-title`}>
      <div className="admin-section-heading admin-section-heading--compact">
        <div>
          <p className="admin-section-kicker">{config.slot}</p>
          <h2 id={`${config.slot}-title`}>{config.title}</h2>
          <span>{config.description}</span>
        </div>
        <p className="admin-content-count">
          已选择 {values.filter(Boolean).length} 条
        </p>
      </div>

      <div className="admin-home-slot-rows">
        {values.length === 0 ? (
          <div className="admin-inline-empty">
            <p>还没有选择内容。</p>
            <span>添加一行，将已发布内容放入此位置。</span>
          </div>
        ) : (
          values.map((value, index) => (
            <div className="admin-home-slot-row" key={`${config.slot}-${index}`}>
              <span className="admin-home-slot-order">{index + 1}</span>
              <label className="admin-form-field">
                <span>已发布内容</span>
                <select
                  name={config.slot}
                  value={value}
                  onChange={(event) => onChange(index, event.target.value)}
                >
                  <option value="">无</option>
                  {options.map((option) => (
                    <option key={option.contentId} value={option.contentId}>
                      {optionLabel(option)}
                    </option>
                  ))}
                </select>
              </label>
              <button
                className="admin-secondary-action"
                type="button"
                onClick={() => onRemove(index)}
              >
                移除
              </button>
            </div>
          ))
        )}
      </div>

      <button
        className="admin-secondary-action"
        type="button"
        onClick={onAdd}
        disabled={options.length === 0}
      >
        添加内容
      </button>
    </section>
  );
}

export function HomeCurationForm({
  currentlyGrowing,
  recentlyPlanted,
  options,
}: HomeCurationFormProps) {
  const [state, formAction] = useActionState(
    saveHomeCurationAction,
    INITIAL_HOME_CURATION_ACTION_STATE,
  );
  const [slotValues, setSlotValues] = useState<
    Record<HomeCurationSlot, string[]>
  >({
    currentlyGrowing: currentlyGrowing.map((item) => item.contentId),
    recentlyPlanted: recentlyPlanted.map((item) => item.contentId),
  });

  function updateSlot(
    slot: HomeCurationSlot,
    updater: (current: string[]) => string[],
  ) {
    setSlotValues((current) => ({
      ...current,
      [slot]: updater(current[slot]),
    }));
  }

  return (
    <form className="admin-home-curation-form" action={formAction}>
      <Notice state={state} />

      {options.length === 0 ? (
        <div className="admin-form-notice" role="alert">
          <strong>没有已发布内容</strong>
          <span>请先发布内容，再添加首页精选行。</span>
        </div>
      ) : null}

      {SLOT_CONFIGS.map((config) => (
        <SlotRows
          key={config.slot}
          config={config}
          values={slotValues[config.slot]}
          options={options}
          onChange={(index, value) =>
            updateSlot(config.slot, (current) =>
              current.map((item, itemIndex) =>
                itemIndex === index ? value : item,
              ),
            )
          }
          onAdd={() => updateSlot(config.slot, (current) => [...current, ""])}
          onRemove={(index) =>
            updateSlot(config.slot, (current) =>
              current.filter((_, itemIndex) => itemIndex !== index),
            )
          }
        />
      ))}

      <div className="admin-editor-actions">
        <SubmitButton />
      </div>
    </form>
  );
}
