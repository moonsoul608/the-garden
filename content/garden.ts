import type { GardenItem } from "@/types";

export const gardenItems = [
  { id: "building-the-garden", slug: "building-the-garden", title: "Building The Garden", summary: "设计并搭建一座可以自由探索的个人数字花园。", beds: ["Coding", "Design & Making"], region: "Garden", contentType: "Seed", categories: ["Coding", "Design & Making"], status: "Growing", cta: "See how it grows →", detailLevel: "full" },
  { id: "learning-psychological-statistics", slug: "learning-psychological-statistics", title: "Learning Psychological Statistics", summary: "整理心理统计学中的检验方向、置信区间和常见题型。", beds: ["Psychology"], region: "Garden", contentType: "Seed", categories: ["Psychology"], status: "Growing", cta: "Open this seed →", detailLevel: "full" },
  { id: "exploring-ai-tools", slug: "exploring-ai-tools", title: "Exploring AI Tools", summary: "尝试理解 AI 如何帮助学习、创作和表达。", beds: ["AI"], region: "Garden", contentType: "Seed", categories: ["AI"], status: "Sprout", cta: "Follow this seed →", detailLevel: "short" },
  { id: "python-starting-from-the-basics", slug: "python-starting-from-the-basics", title: "Python: Starting from the Basics", summary: "记录从环境配置、基础语法到简单练习的学习过程。", beds: ["Coding"], region: "Garden", contentType: "Seed", categories: ["Coding"], status: "Sprout", cta: "See the first steps →", detailLevel: "short" },
  { id: "designing-better-slides-and-documents", slug: "designing-better-slides-and-documents", title: "Designing Better Slides and Documents", summary: "整理自己在 PPT、Word、排版和信息表达中的实践。", beds: ["Design & Making"], region: "Garden", contentType: "Seed", categories: ["Design & Making"], status: "Sprout", cta: "See how it is made →", detailLevel: "short" },
] satisfies GardenItem[];
