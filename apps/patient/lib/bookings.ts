import { supabase } from "./supabase";
import { PATIENT_WEB_URL } from "./config";

export interface NewBooking {
  service_type?: string;
  /** a provider the patient picked; the server charges that provider's own price */
  targeted_provider_id?: string | null;
  wellness_package_id?: string | null;
  family_member_id?: string | null;
  scheduled_at?: string | null;
  notes?: string | null;
  patient_lat: number;
  patient_lng: number;
  patient_address: string;
}

/**
 * Creates a booking through the patient web API, the same route the website uses,
 * so the price is always set on the server (provider price, package price or the
 * standard rate) and never trusted from the phone. Returns the new booking id.
 */
export async function createBooking(booking: NewBooking): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Your session has expired. Please sign in again.");

  let res: Response;
  try {
    res = await fetch(`${PATIENT_WEB_URL}/api/bookings`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify(booking),
    });
  } catch {
    throw new Error("Couldn't reach StreetdocMD. Check your internet connection and try again.");
  }
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.booking_id) {
    throw new Error(json?.error ?? `Could not create your booking (${res.status}). Please try again.`);
  }
  return json.booking_id as string;
}
