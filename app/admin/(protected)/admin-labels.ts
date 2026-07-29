import type { ContentLanguage, DetailLevel, Lifecycle } from "@/types";

export const lifecycleLabels: Record<Lifecycle, string> = {
  Draft: "草稿",
  Review: "待审核",
  Published: "已发布",
  Archived: "已归档",
};

export const detailLevelLabels: Record<DetailLevel, string> = {
  short: "简短",
  full: "完整",
};

export const contentLanguageLabels: Record<ContentLanguage, string> = {
  en: "英文",
  zh: "中文",
  bilingual: "双语",
  mixed: "混合语言",
};

export function lifecycleLabel(lifecycle: Lifecycle): string {
  return lifecycleLabels[lifecycle];
}
