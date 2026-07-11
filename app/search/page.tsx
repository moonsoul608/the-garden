import type { Metadata } from "next";
import { forestItems } from "@/content/forest";
import { gardenItems } from "@/content/garden";
import { lakeItems } from "@/content/lake";
import { ruinsItems } from "@/content/ruins";
import { SearchExperience } from "./search-experience";
import "../utilities.css";

export const metadata: Metadata = { title: "Search the Garden", description: "Look for a word. Find a path." };

export default function SearchPage() {
  const items = [...gardenItems, ...forestItems, ...lakeItems, ...ruinsItems];
  return <main id="main-content" tabIndex={-1} className="discovery-page search-page"><header className="discovery-hero"><p className="eyebrow">A word becomes a path</p><h1>Search the Garden</h1><p className="tagline">Look for a word. Find a path.</p><p>输入一个词，看看它会把你带向哪里。</p></header><SearchExperience items={items} /></main>;
}
