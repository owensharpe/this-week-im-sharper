import { SavedClient } from "@/components/dashboard/saved-client";
import { PasswordGate } from "@/components/dashboard/password-gate";

export default function SavedPage() {
  return (
    <PasswordGate
      title="Saved clusters"
      description="Enter the password to view your saved list."
    >
      <SavedClient />
    </PasswordGate>
  );
}
