# Care journeys, chat and reports

Schema and rules: `supabase/migrations/068_care_journey_chat.sql` (needs 067 first).

## Journeys

A care journey is a `care_episodes` row. When a provider accepts a visit that isn't part of a
journey, `bookings_ensure_journey` starts one with that provider as lead. Follow ups and visits booked
from a journey (`bookings.care_episode_id`) join it, and the accepting provider joins its care team.
Lab orders, medicine orders and hospital referrals from its visits are linked by insert triggers.

The patient confirms recovery from My care (`patient-web /api/care/:id`). The lead clinician closes the
journey (`provider-web /api/journeys/:id`), or `close-recovered-journeys` (daily) closes it 7 days after
recovery when no visit or medicine order is open. Unreviewed lab results still block closing (067).

## Chat

`care_journey_messages`. Access is `care_chat_access(episode)`: the journey's clinicians, staff of the
labs, pharmacies and hospitals handling its orders (once the order has reached them), and admins. The
patient never sees it. Everyone in it sees the whole thread.

- Sender, role and name are set by the `care_journey_message_sender` trigger from the signed in account.
- The "Care updates" bot (`sender_role = 'bot'`, `kind = 'update'`) posts through `care_journey_post()`,
  called by triggers on bookings, prescriptions, medicine orders, investigation events, referrals,
  follow ups and journey recovery or closing.
- New human messages notify everyone else in the journey by push (`care_chat_members()`).
- A closed journey's chat is read only.

Screens: `CareChat` component in provider-web (`/dashboard/journeys/:id`) and the admin app
(partner portals `/{type}-portal/journeys/:id`, admin console `/dashboard/journeys/:id`).

## Reports

`apps/admin/src/lib/care-report.ts` builds the PDF with pdf-lib. Admins download any journey's full
report from the console. Patients and providers request one (`care_report_requests`); an admin approves
or refuses it at `/dashboard/reports`. Approving stores the PDF in the private `care-reports` bucket and
the requester downloads it through a 10 minute link. A patient's copy leaves out the care team chat.
