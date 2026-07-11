import type { Metadata } from "next";
import { GreenhouseExperience } from "./greenhouse-experience";
import "./greenhouse.css";

export const metadata: Metadata = {
  title: "Greenhouse",
  description: "Give an idea somewhere to grow with the Seed Gardener.",
};

type GreenhousePageProps = {
  searchParams: Promise<{ idea?: string | string[] }>;
};

export default async function GreenhousePage({ searchParams }: GreenhousePageProps) {
  const params = await searchParams;
  const initialIdea = typeof params.idea === "string" ? params.idea : "";
  return <GreenhouseExperience initialIdea={initialIdea} />;
}

