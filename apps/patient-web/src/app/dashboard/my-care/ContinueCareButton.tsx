import Link from "next/link";

const DEFAULT_SERVICE_BY_PROFESSION: Record<string, string> = {
  doctor: "general_consultation",
  nurse: "nursing_care",
  physiotherapist: "physiotherapy_session",
};

export default function ContinueCareButton({
  providerName, profession, available, careEpisodeId,
}: {
  providerName: string;
  profession: string;
  available: boolean;
  careEpisodeId: string;
}) {
  const defaultService = DEFAULT_SERVICE_BY_PROFESSION[profession];
  if (!defaultService) return null;

  const href = `/dashboard/book/${defaultService}?care_episode_id=${careEpisodeId}`;

  // We show who the lead clinician is and whether they're free, but the
  // booking itself still goes through the normal profession-matched
  // dispatch flow rather than pinning to one specific provider — dispatch
  // has no support for guaranteeing a specific provider post-payment yet,
  // and patients should never be locked out of choosing someone else
  // regardless. The follow-up booking still links back to this episode.
  return (
    <div className="mt-4 pt-4 border-t border-gray-100">
      {available ? (
        <>
          <p className="text-sm text-gray-600 mb-2">
            <span className="font-medium text-gray-900">{providerName}</span> is available for your next visit.
          </p>
          <Link href={href} className="text-sm text-blue-brand font-medium hover:underline">
            Continue your care with {providerName.split(" ")[0]} →
          </Link>
        </>
      ) : (
        <>
          <p className="text-sm text-gray-500 mb-2">{providerName} isn't available right now.</p>
          <Link href={href} className="text-sm text-blue-brand font-medium hover:underline">
            Book with an available provider →
          </Link>
        </>
      )}
    </div>
  );
}
