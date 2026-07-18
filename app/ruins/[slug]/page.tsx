import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  ArchivedDetailPage,
  PublicDetailPage,
} from "@/components/public-detail-page";
import {
  getPublicContentMetadata,
  getPublicContentStaticParams,
  resolvePublicContentRoute,
} from "@/lib/content/public-route-integration";

import "@/app/detail.css";

type Props = { params: Promise<{ slug: string }> };
const region = "Ruins" as const;

export const dynamicParams = true;

export function generateStaticParams() {
  return getPublicContentStaticParams(region);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return getPublicContentMetadata(region, slug);
}

export default async function RuinsDetail({ params }: Props) {
  const { slug } = await params;
  const disposition = await resolvePublicContentRoute(region, slug);
  if (disposition.kind === "not_found") notFound();
  if (disposition.kind === "archived") {
    return <ArchivedDetailPage item={disposition.content} />;
  }
  return <PublicDetailPage item={disposition.content} />;
}
