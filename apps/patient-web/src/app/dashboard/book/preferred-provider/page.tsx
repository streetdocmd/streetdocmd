import PreferredProviderClient from "./PreferredProviderClient";

export default function PreferredProviderPage({
  searchParams,
}: {
  searchParams: { retarget?: string; code?: string };
}) {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-[24px] font-extrabold leading-tight tracking-[-0.02em] text-navy">
          {searchParams.retarget ? "Choose a different provider" : "Book a Preferred Provider"}
        </h1>
        <p className="text-muted text-sm mt-0.5">
          Enter the code your provider shared with you
        </p>
      </div>

      <PreferredProviderClient retargetBookingId={searchParams.retarget ?? null} initialCode={searchParams.code ?? ""} />
    </div>
  );
}
