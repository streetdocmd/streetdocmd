import Image from "next/image";
import SignOutButton from "@/components/SignOutButton";

// Onboarding screens get the same navy header as the dashboard (without the
// nav — there's nothing to navigate to until the account is verified) and a
// way to sign out, which the documents/pending screens never had.
export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <header className="bg-gradient-to-b from-navy-700 to-navy-800 text-white shadow-[0_1px_0_rgba(255,255,255,0.06),0_2px_8px_rgba(0,0,0,0.12)]">
        <div className="max-w-3xl mx-auto px-4 sm:px-5 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Image src="/logo-white.png" alt="StreetdocMD" width={220} height={88} className="h-9 w-auto" priority />
            <span className="hidden sm:inline-block rounded-md bg-white/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-blue-100">
              Provider
            </span>
          </div>
          <SignOutButton />
        </div>
      </header>
      <main className="flex-1 w-full max-w-xl mx-auto px-4 py-8 sm:py-10">{children}</main>
      <footer className="pb-8 text-center text-xs text-gray-400">
        Need help? Email{" "}
        <a href="mailto:support@streetdocmd.com" className="text-blue-brand hover:underline">support@streetdocmd.com</a>
      </footer>
    </div>
  );
}
