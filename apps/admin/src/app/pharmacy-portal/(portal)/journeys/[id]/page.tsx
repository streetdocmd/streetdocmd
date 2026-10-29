import JourneyPage from "@/components/portal/JourneyPage";

export const dynamic = "force-dynamic";

export default function PharmacyJourneyPage({ params }: { params: { id: string } }) {
  return <JourneyPage type="pharmacy" id={params.id} />;
}
