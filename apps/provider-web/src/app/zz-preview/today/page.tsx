// TEMPORARY visual preview (not committed): online card and request card.
import Navbar from "@/components/Navbar";
import AvailabilityToggle from "@/app/dashboard/AvailabilityToggle";
import DispatchCard from "@/app/dashboard/DispatchCard";

export default function Preview() {
  const now = Date.now();
  return (
    <div className="min-h-screen flex flex-col bg-page">
      <Navbar providerName="Adaeze Okonkwo" specialty="General practice" profession="doctor" />
      <main className="flex-1 mx-auto w-full max-w-3xl px-5 pt-5 pb-28">
        <small className="text-[13px] font-semibold text-muted">Today · General practice</small>
        <h1 className="mb-4 mt-0.5 text-[26px] font-extrabold leading-tight tracking-[-0.02em] text-navy">Good afternoon, Adaeze</h1>
        <AvailabilityToggle providerId="x" initialAvailable={true} />
        <div className="mt-3.5">
          <DispatchCard request={{ id: "d", booking_id: "b", sent_at: new Date(now - 48_000).toISOString(), expires_at: new Date(now + 72_000).toISOString(), distance_km: 3.4,
            bookings: { service_type: "general_consultation", patient_address: "14 Adelabu Street, Ikeja, Lagos", fee: 12000, net_payout: 9600, notes: "Cough and mild fever for three days",
              patient: { first_name: "Ade", age: 34, allergies: ["Penicillin"] } } }} />
        </div>
      </main>
    </div>
  );
}
