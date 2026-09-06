import PreferredProviderClient from "./PreferredProviderClient";

export default function PreferredProviderPage({
  searchParams,
}: {
  searchParams: { retarget?: string };
}) {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          {searchParams.retarget ? "Choose a different provider" : "Book a Preferred Provider"}
        </h1>
        <p className="text-gray-500 text-sm mt-0.5">
          Enter the code your provider shared with you
        </p>
      </div>

      <PreferredProviderClient retargetBookingId={searchParams.retarget ?? null} />
    </div>
  );
}
