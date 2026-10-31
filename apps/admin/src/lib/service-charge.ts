// Patient service charge on what facilities supply. The patient app has the
// full explanation in its lib/service-charge.ts; both read the same setting.

const DEFAULT_SERVICE_CHARGE_RATE = 0.05;

type SettingsReader = {
  from: (table: string) => any;
};

export async function getServiceChargeRate(db: SettingsReader): Promise<number> {
  const { data } = await db.from("platform_settings").select("value").eq("key", "patient_service_charge_rate").maybeSingle();
  const rate = typeof data?.value === "number" ? data.value : Number(data?.value);
  return Number.isFinite(rate) && rate >= 0 && rate < 1 ? rate : DEFAULT_SERVICE_CHARGE_RATE;
}
