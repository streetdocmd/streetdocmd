# Investigations (lab tests)

One fulfilment engine serves both ways a test is started. Schema and rules live in
`supabase/migrations/067_investigation_workflows.sql`.

| | Doctor requested | Patient initiated |
|---|---|---|
| Starts in | provider-web visit notes (`Step13Recommendations`, `POST /api/investigations`) | patient-web test picker (`POST /api/investigations`) |
| First status | `awaiting_patient_approval` | `draft` |
| Sample | lab collects at home, or the doctor took it in the visit (`collection_method = 'doctor'`, no collection fee) | lab collects at home |
| After results | `doctor_review_pending`, then `reviewed` or `follow_up_required`, then `completed` | `completed` once the patient opens the results |

## Flow

1. **Checkout** (`patient-web /api/investigations/:id/checkout`): the patient confirms address, date and
   time window, phone, and optionally an outside doctor's request. The server prices the order with
   `investigation_quote()` and starts a Paystack payment (`metadata.type = "investigation_order"`).
2. **Payment**: only the admin webhook confirms, through `investigation_confirm_payment()`. It is
   idempotent and needs the exact order total. The order becomes `paid_awaiting_lab`, then the lab
   chosen at checkout is asked (`lab_requested`).
3. **Lab**: 30 minutes to accept or decline (`/api/lab-portal/orders/:id/respond`). A decline, or the
   `investigation-lab-timeouts` cron job (every 5 minutes), asks the next best lab. After 3 labs, or with
   none left, the order becomes `exception` and appears in the admin Labs page.
4. **Collection and processing**: `collection_scheduled`, `sample_collected` (identity check and
   collector required), optional `in_transit`, `received_at_lab`, `analysis_in_progress`.
5. **Results**: `/api/lab-portal/orders/:id/results`. Reports go to the private `lab-results` bucket;
   the database keeps the path and every viewer gets a 10 minute signed link from a route that checks
   their access. A `critical` flag raises urgent notifications to the doctor and admins.

## Which tests can be ordered

Any test. The shared list of tests (`scope = 'platform'`) is only a common name that lets two labs'
versions of a test match the same order, and it grows by itself (migration 073):

- A lab adds any test to its price list. Its name is matched to the shared list, case insensitive,
  or added to it as a new test (`investigation_platform_test()`).
- A doctor can request a test nobody lists. It joins the list as `requested_only` (hidden from the
  patient's self service picker) and every active lab is asked to price it. The patient can pay as
  soon as a lab near them lists every test on the order; the first lab to list a requested test
  notifies patients whose orders were waiting on it.

## Rules

- **Price**: the best lab is picked before checkout: cheapest total (its listed test prices plus its home
  collection fee), then rating, then distance. Labs rated under 3 with 3 or more reviews are skipped. The
  patient pays that plus the patient service charge (`platform_settings.patient_service_charge_rate`),
  which is worked out on the test prices only, not the collection fee.
  A fallback lab fulfils at the price already paid; `lab_price_total` records what that lab earns.
- **Matching**: a lab must offer every requested test (its catalogue rows are linked to StreetdocMD tests
  by `investigation_catalogue.platform_test_id`), be active, collect at home (unless the doctor took the
  sample) and be within its `service_radius_km` of the collection address.
- **Cancellation**: patients can decline or cancel before paying, never after. Admins can cancel an
  `exception` order, which marks `refund_status = 'due'` for Finance.
- **Status changes** only go through `investigation_transition()`, which checks `investigation_can_move()`
  and writes `investigation_order_events` (who, when, what). That table is the audit trail.
- **Care episodes** can't be closed or resolved while a linked investigation is unreviewed, unless
  `investigation_handover_note` is filled in.
- **Privacy**: notifications never include test names or values. Labs see the patient's first name only
  until they accept, then contact details and the address. Patients can share results with a doctor of
  their choice through a 7 day, revocable link (`/share/results/:token`).

## Older app builds

The mobile apps still insert orders directly with status `ordered`. A `BEFORE INSERT` trigger turns those
into `awaiting_patient_approval` (doctor) or `draft` (patient), clears any lab or payment fields, and fills
`platform_test_id` on each test. Patients finish and pay for them on the web.

## Statuses

See `src/lib/investigation-status.ts` in each web app for labels and groups. Orders from before
migration 067 were mapped onto the new list and marked `payment_status = 'not_required'`.
