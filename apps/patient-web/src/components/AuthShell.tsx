import Image from "next/image";

// Shared frame for the sign-in / sign-up / password / onboarding screens so
// they all carry the same brand mark and spacing.
export default function AuthShell({
  subtitle = "Home healthcare, on demand",
  maxWidth = "max-w-md",
  children,
}: {
  subtitle?: string;
  maxWidth?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-navy-700 to-navy-900 flex items-center justify-center px-4 py-10">
      <div className={`w-full ${maxWidth}`}>
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-3">
            <div className="w-10 h-10 rounded-xl overflow-hidden bg-white flex items-center justify-center">
              <Image src="/mark.jpg" alt="" width={40} height={40} className="object-contain" priority />
            </div>
            <span className="text-white font-bold text-xl">StreetdocMD</span>
          </div>
          {subtitle && <p className="text-blue-200 text-sm">{subtitle}</p>}
        </div>
        <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-xl">{children}</div>
      </div>
    </div>
  );
}
