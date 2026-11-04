import { SERVICE_LABELS, type Profession, type ServiceType } from "@streetdocmd/shared";
import { rateTypesFor } from "@/lib/rates";

export interface RateField {
  type: ServiceType;
  label: string;
  /** The provider's current active rate row for this service, if any */
  rowId: string | null;
  price: number | null;
}

export interface SetupItem {
  key: "photo" | "bio" | "hours" | "bank";
  title: string;
  why: string;
  href: string;
  done: boolean;
}

export interface SetupState {
  providerId: string;
  profession: Profession;
  rates: RateField[];
  /** Rates are mandatory: patients can't book a service without one */
  ratesMissing: boolean;
  available: boolean;
  items: SetupItem[];
  complete: boolean;
}

/** Everything the setup guide and the dashboard card need, from the provider row and their active rate rows. */
export function setupState(provider: any, rateRows: { id: string; service_type: string | null; price: number | string }[]): SetupState {
  const rates: RateField[] = provider.profession
    ? rateTypesFor(provider.profession).map(type => {
        const row = rateRows.find(r => r.service_type === type && Number(r.price) > 0);
        return { type, label: SERVICE_LABELS[type], rowId: row?.id ?? null, price: row ? Number(row.price) : null };
      })
    : [];
  const items: SetupItem[] = [
    {
      key: "photo",
      title: "Add a profile photo",
      why: "Patients choose who comes into their home. A clear photo of your face helps them pick you.",
      href: "/dashboard/profile",
      done: !!provider.photo_url,
    },
    {
      key: "bio",
      title: "Write a short bio",
      why: "A few lines about your experience and what you treat.",
      href: "/dashboard/profile#about",
      done: !!(provider.bio && String(provider.bio).trim()),
    },
    {
      key: "hours",
      title: "Set your working hours and service radius",
      why: "Patients can only schedule visits inside your hours and distance.",
      href: "/dashboard/profile#availability",
      done: !!(provider.weekly_hours || (provider.working_hours_start && provider.working_hours_end)),
    },
    {
      key: "bank",
      title: "Add your bank details",
      why: "Your earnings are paid into this account when you withdraw.",
      href: "/dashboard/profile#payouts",
      done: !!(provider.bank_name && provider.bank_account_number && provider.bank_account_name),
    },
  ];
  const ratesMissing = rates.some(r => r.price === null);
  const available = !!provider.available;
  return {
    providerId: provider.id,
    profession: provider.profession,
    rates,
    ratesMissing,
    available,
    items,
    complete: !ratesMissing && available && items.every(i => i.done),
  };
}

/** Opens the setup guide from anywhere on the dashboard */
export const OPEN_SETUP_EVENT = "sdm:open-setup";
