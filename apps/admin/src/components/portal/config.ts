// Shared, client-safe configuration for the three partner portals.
// No server imports here: both server guards and client chrome read it.

export type PortalType = "lab" | "pharmacy" | "hospital";
export type StaffRole = "lab_staff" | "pharmacy_staff" | "hospital_staff";

export interface PortalConfig {
  type: PortalType;
  base: string;
  name: string;          // "Lab Partner Portal"
  facilityNoun: string;  // "laboratory"
  role: StaffRole;
  staffTable: "lab_staff" | "pharmacy_staff" | "hospital_staff";
  partnerTable: "lab_partners" | "pharmacy_partners" | "hospital_partners";
  partnerKey: "lab_partner_id" | "pharmacy_partner_id" | "hospital_partner_id";
}

export const PORTALS: Record<PortalType, PortalConfig> = {
  lab: {
    type: "lab", base: "/lab-portal", name: "Lab Partner Portal", facilityNoun: "laboratory",
    role: "lab_staff", staffTable: "lab_staff", partnerTable: "lab_partners", partnerKey: "lab_partner_id",
  },
  pharmacy: {
    type: "pharmacy", base: "/pharmacy-portal", name: "Pharmacy Partner Portal", facilityNoun: "pharmacy",
    role: "pharmacy_staff", staffTable: "pharmacy_staff", partnerTable: "pharmacy_partners", partnerKey: "pharmacy_partner_id",
  },
  hospital: {
    type: "hospital", base: "/hospital-portal", name: "Hospital Partner Portal", facilityNoun: "hospital",
    role: "hospital_staff", staffTable: "hospital_staff", partnerTable: "hospital_partners", partnerKey: "hospital_partner_id",
  },
};

export const ROLE_TO_PORTAL: Record<string, PortalType> = {
  lab_staff: "lab",
  pharmacy_staff: "pharmacy",
  hospital_staff: "hospital",
};

export const SUPPORT_EMAIL = "contact@streetdocmd.com";
export const SUPPORT_MAILTO = `mailto:${SUPPORT_EMAIL}`;
