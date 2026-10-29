"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import { cx } from "@/components/ds";

// Both PNGs share one canvas, so giving them the same box keeps the blob
// exactly behind the doctor. He fills the hero's height and his head rises
// a little over the navbar at the top of the page.
const BOX = "pointer-events-none absolute -top-[22px] bottom-0 right-[-16px] aspect-[535/466] select-none sm:right-4";

export default function HeroPortrait() {
  const [atTop, setAtTop] = useState(true);

  useEffect(() => {
    const onScroll = () => setAtTop(window.scrollY < 4);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      {/* Blob: behind the greeting, so text running over it stays readable */}
      <div aria-hidden className={cx(BOX, "z-0")}>
        <Image src="/splash-transparent.png" alt="" width={535} height={466} priority
          className="h-full w-full object-contain object-bottom dark:opacity-30" />
      </div>
      {/* Doctor: above the navbar at the top of the page; once the page
          scrolls he drops behind the sticky navbar so it stays clean */}
      <div aria-hidden className={cx(BOX, atTop ? "z-40" : "z-0")}>
        <Image src="/founder-doctor-portrait-transparent.png" alt="" width={535} height={466} priority
          className="h-full w-full object-contain object-bottom" />
      </div>
    </>
  );
}
