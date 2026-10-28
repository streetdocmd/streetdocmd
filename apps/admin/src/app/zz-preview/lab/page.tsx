import PortalChrome from "@/components/portal/PortalChrome";
import TestMenuClient from "@/app/lab-portal/(portal)/tests/TestMenuClient";
const T = (id: string, n: string, p: number, on = true, prep: string | null = null, home = true) => ({ id, test_name: n, test_code: null, price: p, turnaround_hours: 24, sample_type: "Blood", home_collection: home, active: on, preparation: prep, price_updated_at: "2026-10-12T10:00:00Z" });
export default function P() {
  return (
    <PortalChrome type="lab" userName="Ada Obi" userEmail="ada@lab.ng" facilityName="Mainstay Diagnostics" showNav>
      <TestMenuClient canEdit loadError={null} tests={[T("1", "Full blood count", 6500), T("2", "Lipid profile", 12000, true, "Fast for 10 to 12 hours before the sample"), T("3", "Stool culture", 8500, false, null, false)]} />
    </PortalChrome>
  );
}
