import Image from "next/image";

/** Brand lockup above every auth card — same as patient-web's sign-in screens. */
export default function AuthBrand({ subtitle = "Provider Portal" }: { subtitle?: string }) {
  return (
    <div className="text-center mb-8">
      <div className="inline-flex items-center gap-2 mb-3">
        <div className="w-10 h-10 rounded-xl overflow-hidden bg-white flex items-center justify-center">
          <Image src="/mark.jpg" alt="" width={40} height={40} className="object-contain" priority />
        </div>
        <span className="text-white font-bold text-xl">StreetdocMD</span>
      </div>
      <p className="text-blue-200 text-sm">{subtitle}</p>
    </div>
  );
}
