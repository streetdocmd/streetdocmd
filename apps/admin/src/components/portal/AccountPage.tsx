import { Mail } from "lucide-react";
import ChangePasswordForm from "./ChangePasswordForm";
import FacilityAgreementRecord from "@/components/legal/FacilityAgreementRecord";
import { getFacilityAgreementRecord } from "@/lib/facility-agreement-server";
import { requirePortalAccess } from "./access";
import { PORTALS, SUPPORT_EMAIL, SUPPORT_MAILTO, type PortalType } from "./config";
import { Card, CardHeader, DetailRow, PageHeader, StatusBadge, formatNaira, ui } from "./ui";

const yesNo = (v: unknown) => (v ? "Yes" : "No");

function facilityRows(type: PortalType, p: Record<string, any>): { label: string; value: string }[] {
  const common = [
    { label: "Facility name", value: p.name },
    { label: "Phone", value: p.phone },
    { label: "Email", value: p.email },
    { label: "Address", value: p.address },
  ];
  if (type === "lab") return [...common, { label: "Home sample collection", value: yesNo(p.home_collection_available) }];
  if (type === "pharmacy") return [
    ...common,
    { label: "Delivery radius", value: p.delivery_radius_km != null ? `${p.delivery_radius_km} km` : "" },
    ...(p.delivery_fee != null ? [{ label: "Delivery fee", value: formatNaira(p.delivery_fee) }] : []),
  ];
  return [
    ...common,
    { label: "Level", value: p.hospital_level ? String(p.hospital_level).replace(/_/g, " ") : "" },
    { label: "Emergency department", value: p.emergency_available ? "Available" : "Not available" },
    { label: "Ambulance", value: p.ambulance_available ? "Available" : "Not available" },
    { label: "Bed count", value: p.bed_count != null ? String(p.bed_count) : "" },
  ];
}

export default async function AccountPage({ type }: { type: PortalType }) {
  const access = await requirePortalAccess(type);
  const cfg = PORTALS[type];
  const p = access.partner;
  const specialties: string[] = Array.isArray(p?.specialties) ? p!.specialties : [];
  const agreement = access.isAdmin ? null : await getFacilityAgreementRecord(access.user.id);

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader title={type === "hospital" ? "Facility & account" : "Account"} description={`Your ${cfg.facilityNoun}'s details on StreetdocMD and your sign-in settings.`} />

      <Card>
        <CardHeader
          title="Facility profile"
          description="This is what StreetdocMD doctors and patients see."
          actions={p ? <StatusBadge tone={p.active === false ? "amber" : "green"}>{p.active === false ? "Paused" : "Active"}</StatusBadge> : undefined}
        />
        <div className="p-5">
          {p ? (
            <>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                {facilityRows(type, p).map(r => <DetailRow key={r.label} label={r.label} value={r.value} />)}
              </dl>
              {specialties.length > 0 && (
                <div className="mt-5">
                  <p className="text-xs font-medium text-muted mb-2">Specialties</p>
                  <div className="flex flex-wrap gap-1.5">
                    {specialties.map(s => <StatusBadge key={s} tone="navy">{s}</StatusBadge>)}
                  </div>
                </div>
              )}
              <p className="mt-5 pt-4 border-t border-line text-xs text-muted">
                Need to change any of these?{" "}
                <a href={SUPPORT_MAILTO} className="font-medium text-accent hover:underline inline-flex items-center gap-1">
                  <Mail size={12} aria-hidden /> Email {SUPPORT_EMAIL}
                </a>{" "}
                and we&apos;ll update them for you.
              </p>
            </>
          ) : (
            <p className="text-sm text-muted">You&apos;re viewing this portal as a StreetdocMD admin, so there&apos;s no facility profile.</p>
          )}
        </div>
      </Card>

      {agreement && (
        <Card>
          <CardHeader
            title="Partner agreement"
            description="The terms your facility accepted to join the StreetdocMD partner network."
          />
          <div className="p-5">
            <FacilityAgreementRecord
              version={agreement.version}
              acceptedAt={agreement.acceptedAt}
              acceptedName={agreement.acceptedName}
            />
          </div>
        </Card>
      )}

      <Card>
        <CardHeader title="Sign-in details" />
        <div className="p-5">
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
            <DetailRow label="Name" value={access.user.name} />
            <DetailRow label="Email" value={access.user.email} />
          </dl>
        </div>
      </Card>

      <Card>
        <CardHeader title="Change password" description="Use at least 8 characters. You'll stay signed in on this device." />
        <div className="p-5">
          <ChangePasswordForm email={access.user.email} />
        </div>
      </Card>

      <p className={`${ui.hint} pb-4`}>
        Forgotten your password? Sign out and use &ldquo;Forgot password?&rdquo; on the sign-in page.
      </p>
    </div>
  );
}
