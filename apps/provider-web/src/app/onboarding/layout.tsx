import Image from "next/image";
import SignOutButton from "@/components/SignOutButton";

// Onboarding screens get the dashboard's header (without the nav: there's
// nothing to navigate to until the account is verified) and a way to sign out.
export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-page">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between gap-3 px-5">
          <div className="flex items-center gap-2.5">
            <Image src="/logo.png" alt="StreetdocMD" width={220} height={88} className="h-9 w-auto" priority />
            <span className="rounded-md bg-teal-tint px-2 py-0.5 text-ds-2xs font-bold uppercase tracking-[0.04em] text-teal-deep">
              Provider
            </span>
          </div>
          <SignOutButton />
        </div>
      </header>
      <main className="mx-auto w-full max-w-xl flex-1 px-5 py-8 sm:py-10">{children}</main>
      <footer className="pb-8 text-center text-ds-xs text-muted">
        Need help? Email{" "}
        <a href="mailto:contact@streetdocmd.com" className="font-bold text-accent hover:underline">contact@streetdocmd.com</a>
      </footer>
    </div>
  );
}
