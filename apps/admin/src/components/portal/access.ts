// Server-only access resolution for the partner portals. Used by each
// portal's (portal) layout (to decide what to render) and by every portal page
// and API route (so a page never serves data the layout would have hidden).
import { redirect } from "next/navigation";
import { createAdminSupabase, createServerSupabase } from "@/lib/supabase-server";
import { getUnapprovedApplication, type PendingApplication } from "@/components/FacilityApplicationStatus";
import { PORTALS, type PortalType } from "./config";

export interface PortalUser {
  id: string;
  email: string | null;
  name: string | null;
  role: string | null;
  /** Set for accounts an admin created with a temporary (SMS'd) password, until it's changed. */
  usingTempPassword: boolean;
}

export type PortalAccess =
  | { status: "signed_out" }
  | { status: "application"; user: PortalUser; application: PendingApplication }
  | { status: "wrong_role"; user: PortalUser }
  | { status: "not_linked"; user: PortalUser }
  | { status: "inactive"; user: PortalUser; partner: Record<string, any> }
  | {
      status: "ok";
      user: PortalUser;
      isAdmin: boolean;
      /** The facility this staff account belongs to. null for StreetdocMD admins (they see every facility). */
      partnerId: string | null;
      partner: Record<string, any> | null;
    };

export type PortalOk = Extract<PortalAccess, { status: "ok" }>;

export async function getPortalAccess(type: PortalType): Promise<PortalAccess> {
  const cfg = PORTALS[type];
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { status: "signed_out" };

  // Service-role reads, but only for the id Supabase Auth verified from the session.
  const admin = createAdminSupabase();
  const [{ data: profile }, application] = await Promise.all([
    admin.from("users").select("name, role").eq("id", user.id).maybeSingle(),
    getUnapprovedApplication(user.id),
  ]);

  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const portalUser: PortalUser = {
    id: user.id,
    email: user.email ?? null,
    name: (profile?.name as string | undefined) ?? (meta.name as string | undefined) ?? null,
    role: (profile?.role as string | undefined) ?? null,
    usingTempPassword: Boolean(meta.partner_id) && !meta.password_changed,
  };

  if (portalUser.role === "admin") {
    return { status: "ok", user: portalUser, isAdmin: true, partnerId: null, partner: null };
  }

  // Registered but not approved (pending, under review or rejected)
  if (application) return { status: "application", user: portalUser, application };

  if (portalUser.role !== cfg.role) return { status: "wrong_role", user: portalUser };

  const { data: staff } = await admin
    .from(cfg.staffTable)
    .select(cfg.partnerKey)
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  const partnerId = (staff as Record<string, string> | null)?.[cfg.partnerKey] ?? null;
  if (!partnerId) return { status: "not_linked", user: portalUser };

  const { data: partner } = await admin.from(cfg.partnerTable).select("*").eq("id", partnerId).maybeSingle();
  if (!partner) return { status: "not_linked", user: portalUser };

  // Hospitals have always been blocked while inactive. Labs and pharmacies keep
  // access (to finish in-flight orders) and see a "paused" notice instead.
  if (type === "hospital" && partner.active === false) {
    return { status: "inactive", user: portalUser, partner };
  }

  return { status: "ok", user: portalUser, isAdmin: false, partnerId, partner };
}

/**
 * For portal pages: returns the approved context, or redirects. Unapproved
 * users go to the portal root, where the layout shows their status.
 */
export async function requirePortalAccess(type: PortalType): Promise<PortalOk> {
  const access = await getPortalAccess(type);
  if (access.status === "signed_out") redirect(`${PORTALS[type].base}/login`);
  if (access.status !== "ok") redirect(PORTALS[type].base);
  return access;
}

/** For portal API routes: the approved context, or null (respond 401/403). */
export async function getPortalApiAccess(type: PortalType): Promise<
  { ok: true; access: PortalOk } | { ok: false; status: 401 | 403; error: string }
> {
  const access = await getPortalAccess(type);
  if (access.status === "signed_out") return { ok: false, status: 401, error: "Your session has expired. Please sign in again." };
  if (access.status !== "ok") return { ok: false, status: 403, error: "Your account doesn't have access to this portal yet." };
  return { ok: true, access };
}

/** True when this context may act on a record that belongs to `recordPartnerId`. */
export function ownsRecord(access: PortalOk, recordPartnerId: string | null | undefined) {
  return access.isAdmin || (!!access.partnerId && access.partnerId === recordPartnerId);
}
