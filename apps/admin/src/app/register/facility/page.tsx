import FacilityRegClient from "./FacilityRegClient";

export const metadata = { title: "Join the StreetdocMD Partner Network" };

const TYPES = ["lab", "pharmacy", "hospital"] as const;

export default function FacilityRegPage({ searchParams }: { searchParams: { type?: string } }) {
  // ?type=lab|pharmacy|hospital skips the type picker (used by portal sign-in and re-apply links)
  const initialType = TYPES.find(t => t === searchParams.type) ?? null;
  return <FacilityRegClient initialType={initialType} />;
}
