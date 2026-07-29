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

type Props = {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ source?: string | string[] }>;
};
const region = "Lake" as const;

export const dynamicParams = true;

export function generateStaticParams() {
  return getPublicContentStaticParams(region);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return getPublicContentMetadata(region, slug);
}

export default async function LakeDetail({ params, searchParams }: Props) {
  const { slug } = await params;
  const source = (await searchParams)?.source;
  const disposition = await resolvePublicContentRoute(region, slug);
  if (disposition.kind === "not_found") notFound();
  if (disposition.kind === "archived") {
    return <ArchivedDetailPage item={disposition.content} source={source} />;
  }
  return <PublicDetailPage item={disposition.content} source={source} />;
}
