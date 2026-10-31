import Image from "next/image";

// He fills the hero's height, inside the hero.
const BOX = "pointer-events-none absolute top-4 bottom-0 right-[-16px] sm:top-3 aspect-[535/466] select-none sm:right-4";

export default function HeroPortrait() {
  return (
    <>
      {/* The organic curves behind him come from the page backdrop (HomeBackdrop) */}
      <div aria-hidden className={`${BOX} z-[5]`}>
        <Image src="/founder-doctor-portrait-transparent.png" alt="" width={535} height={466} priority
          className="h-full w-full object-contain object-bottom" />
      </div>
    </>
  );
}
