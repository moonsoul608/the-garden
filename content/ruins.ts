import type { RuinsItem } from "@/types";

export const ruinsItems = [
  { id: "first-version-of-home", slug: "first-version-of-home", title: "The first version of Home", summary: "最初的 Home 设计包含过多模块和重复入口，后来被压缩成更清晰的结构。", traceType: "Drafts", region: "Ruins", contentType: "Trace", categories: ["Drafts"], status: "Dormant", cta: "See what changed →", grewInto: "/garden/building-the-garden", detailLevel: "full" },
  { id: "portfolio-never-built", slug: "portfolio-never-built", title: "A portfolio that was never built", summary: "网站最初曾被设想为传统作品集，但因为不符合当前用途，最终转向数字花园。", traceType: "Attempts", region: "Ruins", contentType: "Trace", categories: ["Attempts"], status: "Dormant", cta: "Follow the abandoned path →", grewInto: "/lake/the-garden", detailLevel: "short" },
  { id: "too-much-interaction", slug: "too-much-interaction", title: "Too much interaction", summary: "早期曾设想大量动画、隐藏导航和复杂点击效果，后来发现探索感不能以牺牲可用性为代价。", traceType: "Mistakes", region: "Ruins", contentType: "Trace", categories: ["Mistakes"], status: "Dormant", cta: "See what it taught me →", grewInto: "/forest/why-exploratory-websites-invite-more-clicks", detailLevel: "short" },
  { id: "unfinished-continue", slug: "unfinished-continue", title: "An unfinished version of “继续吗”", summary: "一段没有继续写下去，或后来被新版本替代的小说片段。", traceType: "Drafts", region: "Ruins", contentType: "Trace", categories: ["Drafts"], status: "Dormant", cta: "Read the fragment →", grewInto: "/forest/why-people-fear-forgetting", detailLevel: "short" },
] satisfies RuinsItem[];
