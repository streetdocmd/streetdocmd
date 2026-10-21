import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ShieldAlert, Link2Off, PauseCircle, MessageCircle, KeyRound } from "lucide-react";
import FacilityApplicationStatus from "@/components/FacilityApplicationStatus";
import PortalChrome from "./PortalChrome";
import { getPortalAccess } from "./access";
import { PORTALS, ROLE_TO_PORTAL, SUPPORT_WHATSAPP_URL, SUPPORT_PHONE_DISPLAY, type PortalType } from "./config";
import { Notice, ui } from "./ui";

function Blocked({ icon: Icon, title, children, action }: {
  icon: typeof ShieldAlert; title: string; children: ReactNode; action?: ReactNode;
}) {
  return (
    <div className="max-w-xl mx-auto py-4 sm:py-10">
      <div className={`${ui.card} p-6 sm:p-8`}>
        <span className="w-12 h-12 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center">
          <Icon size={24} aria-hidden />
        </span>
        <h1 className="mt-4 text-xl font-bold text-gray-900">{title}</h1>
        <div className="mt-2 text-sm text-gray-600 space-y-2">{children}</div>
        <div className="mt-6 flex flex-col sm:flex-row gap-2">
          {action}
          <a href={SUPPORT_WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className={ui.btnSecondary}>
            <MessageCircle size={15} aria-hidden /> WhatsApp support · {SUPPORT_PHONE_DISPLAY}
          </a>
        </div>
      </div>
    </div>
  );
}

/**
 * Wraps every signed-in page of a partner portal. Facilities that aren't
 * approved (or aren't linked to a facility) see their status here instead of
 * the page, whichever portal URL they open.
 */
export default async function PortalLayout({ type, children }: { type: PortalType; children: ReactNode }) {
  const cfg = PORTALS[type];
  const access = await getPortalAccess(type);
  if (access.status === "signed_out") redirect(`${cfg.base}/login`);

  const user = access.user;
  const facilityName = access.status === "ok" || access.status === "inactive"
    ? (access.partner?.name as string | undefined) ?? (access.status === "ok" && access.isAdmin ? "StreetdocMD admin view" : null)
    : access.status === "application" ? access.application.name : null;

  let body: ReactNode;
  switch (access.status) {
    case "application":
      body = <FacilityApplicationStatus app={access.application} />;
      break;
    case "wrong_role": {
      const ownPortal = access.user.role ? ROLE_TO_PORTAL[access.user.role] : undefined;
      body = (
        <Blocked
          icon={ShieldAlert}
          title={`This account can't use the ${cfg.name}`}
          action={ownPortal && (
            <Link href={PORTALS[ownPortal].base} className={ui.btnPrimary}>Go to the {PORTALS[ownPortal].name}</Link>
          )}
        >
          <p>
            You&apos;re signed in as <strong>{user.email}</strong>, which isn&apos;t a {cfg.facilityNoun} staff account.
            {ownPortal ? " Your account belongs to a different partner portal." : " Sign out from the menu above and sign in with your facility's account."}
          </p>
        </Blocked>
      );
      break;
    }
    case "not_linked":
      body = (
        <Blocked icon={Link2Off} title="Your account isn't linked to a facility yet">
          <p>
            You&apos;re signed in as <strong>{user.email}</strong>, but this login hasn&apos;t been connected to a {cfg.facilityNoun} on
            StreetdocMD. This usually means approval is still being completed. Please contact our partnerships team and we&apos;ll link it for you.
          </p>
        </Blocked>
      );
      break;
    case "inactive":
      body = (
        <Blocked icon={PauseCircle} title="Your facility is currently inactive">
          <p>
            <strong>{access.partner.name}</strong> isn&apos;t receiving referrals right now, so the portal is paused.
            Contact StreetdocMD support to reactivate it.
          </p>
        </Blocked>
      );
      break;
    case "ok":
      body = (
        <>
          {access.user.usingTempPassword && (
            <div className="mb-6">
              <Notice tone="blue" icon={KeyRound}
                action={<Link href={`${cfg.base}/account`} className={ui.btnPrimary}>Change password</Link>}>
                You&apos;re signed in with a temporary password we sent by SMS. Please set your own password now.
              </Notice>
            </div>
          )}
          {!access.isAdmin && access.partner?.active === false && (
            <div className="mb-6">
              <Notice tone="amber" icon={PauseCircle}>
                <strong>{access.partner.name}</strong> is paused on StreetdocMD, so you won&apos;t receive new orders.
                You can still complete existing ones. Contact support to reactivate.
              </Notice>
            </div>
          )}
          {children}
        </>
      );
      break;
  }

  return (
    <PortalChrome
      type={type}
      userName={user.name ?? ""}
      userEmail={user.email}
      facilityName={facilityName ?? null}
      showNav={access.status === "ok"}
    >
      {body}
    </PortalChrome>
  );
}
