import PortalChrome from "@/components/portal/PortalChrome";
import CapacityClient from "@/app/hospital-portal/(portal)/capacity/CapacityClient";
const W = (id: string, n: string, t: number, f: number) => ({ id, ward_name: n, total_beds: t, free_beds: f, updated_at: "" });
export default function P() {
  return (
    <PortalChrome type="hospital" userName="Tunde B" userEmail="t@h.ng" facilityName="Oyo Central Medical Centre" showNav>
      <div className="max-w-2xl space-y-6"><h1 className="text-[26px] font-extrabold text-navy">Capacity</h1>
      <CapacityClient initial={[W("1", "Emergency", 12, 0), W("2", "Maternity", 20, 3), W("3", "General ward", 40, 18)]} /></div>
    </PortalChrome>
  );
}
