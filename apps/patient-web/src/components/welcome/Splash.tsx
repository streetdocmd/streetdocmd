// Brand moment shown before onboarding. The swinging stethoscope cable is the one
// brand motion in the app; it stops (and the loader holds still) under reduced motion.
export default function Splash() {
  return (
    <main
      aria-label="StreetDocMD"
      className="fixed inset-0 z-30 flex flex-col items-center justify-center gap-[22px] overflow-hidden text-white"
      style={{ background: "linear-gradient(165deg, var(--navy) 0%, var(--blue-deep) 55%, var(--blue) 100%)" }}
    >
      {/* Soft circles in the corners */}
      <span aria-hidden className="absolute -top-[140px] -right-[160px] w-[420px] h-[420px] rounded-full bg-white/[0.06]" />
      <span aria-hidden className="absolute -bottom-[120px] -left-[120px] w-[300px] h-[300px] rounded-full bg-white/[0.06]" />

      <span aria-hidden className="relative h-[90px] w-[2px] origin-top animate-swing motion-reduce:animate-none">
        <span className="absolute left-0 top-0 w-[2px] h-[74px] bg-white/85" />
        <span className="absolute -left-[7px] top-[72px] w-4 h-4 rounded-full bg-white" />
      </span>

      <span
        aria-hidden
        className="relative z-[1] grid place-items-center w-[92px] h-[92px] rounded-[28px] bg-white shadow-[0_20px_40px_rgba(0,0,0,0.25)]"
      >
        <svg viewBox="0 0 24 24" className="w-[46px] h-[46px] stroke-brand fill-none" strokeWidth={3} strokeLinecap="round">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </span>

      <p className="relative z-[1] text-[30px] font-extrabold tracking-[-0.02em] leading-none">
        Street<span className="text-brand-pale">DocMD</span>
      </p>
      <p className="relative z-[1] text-ds-control text-brand-mist">Healthcare at your convenience</p>

      <span aria-hidden className="relative z-[1] mt-[18px] w-[120px] h-1 rounded overflow-hidden bg-white/20">
        <span className="block h-full w-[40%] rounded bg-white animate-load motion-reduce:animate-none motion-reduce:w-full" />
      </span>
    </main>
  );
}
