// Patient service charge on what facilities supply: medicines and lab tests, not
// a lab's home collection fee. Individual providers' visits don't carry it: the
// patient pays the listed fee and StreetdocMD's 20 percent comes out of that.
// The rate lives in platform_settings so it can change without a deploy.
// Every amount is calculated on the server; the client only displays it.

export const DEFAULT_SERVICE_CHARGE_RATE = 0.05;

type SettingsReader = {
  from: (table: string) => any;
};

export async function getServiceChargeRate(db: SettingsReader): Promise<number> {
  const { data } = await db.from("platform_settings").select("value").eq("key", "patient_service_charge_rate").maybeSingle();
  const rate = typeof data?.value === "number" ? data.value : Number(data?.value);
  return Number.isFinite(rate) && rate >= 0 && rate < 1 ? rate : DEFAULT_SERVICE_CHARGE_RATE;
}

export function serviceChargeFor(fee: number, rate: number): number {
  return Math.round(fee * rate);
}

/** What the patient pays for a booking row. New bookings have no charge; ones made while it applied keep theirs. */
export function bookingTotal(booking: { fee: number | string; service_charge?: number | string | null }): number {
  return Number(booking.fee) + Number(booking.service_charge ?? 0);
}
