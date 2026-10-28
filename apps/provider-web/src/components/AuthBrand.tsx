import Image from "next/image";

/** Brand lockup above every auth screen, in the design's light style. */
export default function AuthBrand({ subtitle = "Provider Portal" }: { subtitle?: string }) {
  return (
    <div className="mb-8 text-center">
      <Image src="/logo.png" alt="StreetdocMD" width={220} height={88} className="mx-auto h-12 w-auto" priority />
      <p className="mt-2 inline-block rounded-md bg-teal-tint px-2 py-0.5 text-ds-2xs font-bold uppercase tracking-[0.04em] text-teal-deep">
        {subtitle}
      </p>
    </div>
  );
}
