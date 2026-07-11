import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DetailPage } from "@/components";
import { ruinsItems } from "@/content";
import "@/app/detail.css";

type Props = { params: Promise<{ slug: string }> };
export const dynamicParams = false;
export function generateStaticParams() { return ruinsItems.map(({ slug }) => ({ slug })); }
export async function generateMetadata({ params }: Props): Promise<Metadata> { const { slug } = await params; const item = ruinsItems.find((entry) => entry.slug === slug); return item ? { title: item.title, description: item.summary } : {}; }
export default async function RuinsDetail({ params }: Props) { const { slug } = await params; const item = ruinsItems.find((entry) => entry.slug === slug); if (!item) notFound(); return <DetailPage item={item} />; }
