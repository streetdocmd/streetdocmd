import JourneyPage from "@/components/portal/JourneyPage";

export const dynamic = "force-dynamic";

export default function LabJourneyPage({ params }: { params: { id: string } }) {
  return <JourneyPage type="lab" id={params.id} />;
}
