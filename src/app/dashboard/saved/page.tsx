import { SavedClient } from "@/components/dashboard/saved-client";
import { getDigestBundle } from "@/lib/digests";

export default function SavedPage() {
  const bundle = getDigestBundle();
  return <SavedClient bundle={bundle} />;
}
