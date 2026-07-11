import type { SiteRegionName } from "@/types";

export type RegionMetadata = {
  name: SiteRegionName;
  href: string;
  tagline: string;
  description: string;
  accent: string;
};

export const regions = [
  { name: "Home", href: "/", tagline: "A quiet place to begin.", description: "这里是认识我、了解这座花园，以及决定下一条小径从哪里开始的地方。", accent: "home" },
  { name: "Garden", href: "/garden", tagline: "Where learning takes root.", description: "这里记录正在学习、练习和持续成长的内容。", accent: "garden" },
  { name: "Forest", href: "/forest", tagline: "Where questions grow wild.", description: "这里保存问题、思考、观察，以及暂时还没有答案的想法。", accent: "forest" },
  { name: "Lake", href: "/lake", tagline: "Things worth reflecting on.", description: "这里收藏那些曾让我停下来观看、聆听或思考的东西。", accent: "lake" },
  { name: "Ruins", href: "/ruins", tagline: "Ruins are not failures. They are traces.", description: "这里保存废稿、错误、半成品，以及那些没有继续生长、却仍然留下痕迹的尝试。", accent: "ruins" },
  { name: "Greenhouse", href: "/greenhouse", tagline: "Give an idea somewhere to grow.", description: "在这里借助 AI，把一个模糊的想法培育成可以继续探索的 Seed。", accent: "greenhouse" },
] satisfies RegionMetadata[];

export const utilities = [
  { name: "Garden Index", href: "/index" },
  { name: "Search the Garden", href: "/search" },
  { name: "Back to the entrance", href: "/" },
] as const;
