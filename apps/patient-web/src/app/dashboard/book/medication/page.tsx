import { TopBar } from "@/components/ds";
import MedicationPicker from "./MedicationPicker";

export default function MedicationPage() {
  return (
    <div className="mx-auto max-w-lg">
      <TopBar title="Buy medication" backHref="/dashboard" className="-mx-5 -mt-2 md:mx-0" />
      <p className="mb-4 text-ds-xs text-muted">
        Pick what you need from the pharmacy nearest you, and we&apos;ll deliver it to your door.
      </p>
      <MedicationPicker />
    </div>
  );
}
