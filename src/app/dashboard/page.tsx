import { DayView } from "@/components/dashboard/day-view";
import {
  collectTags,
  getAllDigestDates,
  getLatestDigest,
} from "@/lib/digests";

export default function DashboardPage() {
  const availableDates = getAllDigestDates();
  const digest = getLatestDigest();
  const activeDate = digest?.date ?? availableDates[0] ?? null;
  const allTags = collectTags(digest);

  return (
    <DayView
      digest={digest}
      availableDates={availableDates}
      activeDate={activeDate}
      allTags={allTags}
    />
  );
}
