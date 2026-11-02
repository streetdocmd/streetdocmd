import { SERVICE_PROFESSION, type Profession, type ServiceType } from "@streetdocmd/shared";

// The bookable services a profession is dispatched for, each of which needs the
// provider's own rate before patients can book it. Wellness Check is priced by
// the package the patient picks, so it has no provider rate.
export function rateTypesFor(profession: Profession): ServiceType[] {
  return (Object.keys(SERVICE_PROFESSION) as ServiceType[])
    .filter(st => SERVICE_PROFESSION[st] === profession && st !== "wellness_check");
}
