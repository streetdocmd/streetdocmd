import MedicationPicker from "./MedicationPicker";

export default function MedicationPage() {
  return (
    <div className="max-w-lg mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Buy Medication</h1>
        <p className="text-gray-500 mt-1 text-sm">
          Pick what you need from the pharmacy nearest you, and we'll deliver it to your door.
        </p>
      </div>
      <MedicationPicker />
    </div>
  );
}
