import JourneyPage from "@/components/portal/JourneyPage";

export const dynamic = "force-dynamic";

export default function HospitalJourneyPage({ params }: { params: { id: string } }) {
  return <JourneyPage type="hospital" id={params.id} />;
}
