import type { ContentItem } from "@/types";
import { forestItems } from "./forest";
import { gardenItems } from "./garden";
import { lakeItems } from "./lake";
import { ruinsItems } from "./ruins";

export { forestItems, gardenItems, lakeItems, ruinsItems };
export const allContent: ContentItem[] = [...gardenItems, ...forestItems, ...lakeItems, ...ruinsItems];
