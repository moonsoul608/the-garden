import type { GrowthStatus } from "@/types";

const statusIcons: Record<GrowthStatus, string> = { Seed: "🌰", Sprout: "🌱", Growing: "🌿", Bloom: "🌸", Dormant: "🍂" };

export function StatusBadge({ status }: { status: GrowthStatus }) {
  return <span className={`status-badge status-${status.toLowerCase()}`}>{statusIcons[status]} {status}</span>;
}
