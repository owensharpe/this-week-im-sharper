import { DashboardClient } from "@/components/dashboard/dashboard-client";
import { collectTags, getDigestBundle } from "@/lib/digests";

export default function DashboardPage() {
  const bundle = getDigestBundle();
  const allTags = collectTags(bundle);

  return <DashboardClient bundle={bundle} allTags={allTags} />;
}
