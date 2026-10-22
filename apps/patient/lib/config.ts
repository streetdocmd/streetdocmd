// The patient web app hosts the server routes this app calls (bookings, payments).
// Override with EXPO_PUBLIC_PATIENT_WEB_URL (e.g. http://<your-LAN-IP>:3001 in development).
export const PATIENT_WEB_URL = (process.env.EXPO_PUBLIC_PATIENT_WEB_URL ?? "https://app.streetdocmd.com").replace(/\/$/, "");
