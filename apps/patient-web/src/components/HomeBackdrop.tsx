"use client";
import { usePathname } from "next/navigation";

// Home only: the hero's soft blue gradient starts at the very top of the page,
// so the transparent header sits on it. The splash lines up with the hero
// (same width as Home's content), behind the portrait.
export default function HomeBackdrop() {
  if (usePathname() !== "/dashboard") return null;
  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[600px] overflow-hidden sm:h-[680px]">
      <div className="absolute inset-0 bg-gradient-to-b from-[#DCEBFF] via-[#EEF5FF] to-transparent dark:from-blue-500/15 dark:via-blue-500/5" />
      <div className="relative mx-auto h-full max-w-3xl md:max-w-3xl">
        {/* Its own edges are cut off at the right and bottom: faded at the bottom,
            and on wider screens at the right, so it never ends in a hard line */}
        <div className="absolute right-0 top-0 w-[60%] max-w-[480px] sm:-right-6 sm:w-[84%] md:[mask-image:linear-gradient(to_left,transparent,black_30%)]">
          <img src="/images/hero-splash.png" alt="" width={383} height={383}
            className="w-full opacity-[.65] [mask-image:linear-gradient(to_bottom,black_70%,transparent)] dark:opacity-30 sm:opacity-100" />
        </div>
      </div>
    </div>
  );
}
