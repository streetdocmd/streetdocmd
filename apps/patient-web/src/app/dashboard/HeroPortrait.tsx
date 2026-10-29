import Image from "next/image";

// Both PNGs share one canvas, so giving them the same box keeps the blob
// exactly behind the doctor. He fills the hero's height, inside the hero.
const BOX = "pointer-events-none absolute top-3 bottom-0 right-[-16px] aspect-[535/466] select-none sm:right-4";

export default function HeroPortrait() {
  return (
    <>
      {/* Blob: behind the greeting, so text running over it stays readable */}
      <div aria-hidden className={`${BOX} z-0`}>
        <Image src="/splash-transparent.png" alt="" width={535} height={466} priority
          className="h-full w-full object-contain object-bottom dark:opacity-30" />
      </div>
      <div aria-hidden className={`${BOX} z-[5]`}>
        <Image src="/founder-doctor-portrait-transparent.png" alt="" width={535} height={466} priority
          className="h-full w-full object-contain object-bottom" />
      </div>
    </>
  );
}
