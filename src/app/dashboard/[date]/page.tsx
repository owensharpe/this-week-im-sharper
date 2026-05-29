import { notFound } from "next/navigation";

import { DayView } from "@/components/dashboard/day-view";
import {
  collectTags,
  getAllDigestDates,
  getDigestByDate,
} from "@/lib/digests";

export async function generateStaticParams() {
  return getAllDigestDates().map((date) => ({ date }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const { date } = await params;
  return {
    title: `${date} — This Week I'm Sharper`,
  };
}

export default async function DashboardDatePage({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const { date } = await params;
  const digest = getDigestByDate(date);
  if (!digest) notFound();

  const availableDates = getAllDigestDates();
  const allTags = collectTags(digest);

  return (
    <DayView
      digest={digest}
      availableDates={availableDates}
      activeDate={date}
      allTags={allTags}
    />
  );
}
