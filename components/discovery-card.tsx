import Link from "next/link";
import { getContentHref } from "@/lib/content-discovery";
import type { ContentItem } from "@/types";

type DiscoveryCardProps = {
  item: ContentItem;
  compact?: boolean;
};

export function DiscoveryCard({ item, compact = false }: DiscoveryCardProps) {
  const category = item.categories[0];

  return (
    <Link className={`discovery-card card${compact ? " discovery-card-compact" : ""}`} href={getContentHref(item)}>
      <div className="discovery-card-meta">
        <span>{item.region}</span>
        <span aria-hidden="true">·</span>
        <span>{item.contentType}</span>
      </div>
      <h3>{item.title}</h3>
      <p>{item.summary}</p>
      {!compact ? <span className="discovery-card-detail">{item.status ?? category}</span> : null}
      <span className="discovery-card-cta">{item.cta}</span>
    </Link>
  );
}
