import Image from "next/image";
import Link from "next/link";

// Shared frame for sign in and the password screens, in the design's light
// style (sign up and onboarding use their own top bars).
export default function AuthShell({
  subtitle = "Healthcare at your convenience",
  maxWidth = "max-w-md",
  children,
}: {
  subtitle?: string;
  maxWidth?: string;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-[100dvh] bg-page">
      <div className={`mx-auto w-full ${maxWidth} px-5 pb-10 pt-10`}>
        <div className="mb-8 text-center">
          <Link href="/" className="inline-block">
            <Image src="/logo.png" alt="StreetdocMD" width={220} height={88} className="mx-auto h-12 w-auto" priority />
          </Link>
          {subtitle && <p className="mt-2 text-ds-sm text-muted">{subtitle}</p>}
        </div>
        {children}
      </div>
    </main>
  );
}
