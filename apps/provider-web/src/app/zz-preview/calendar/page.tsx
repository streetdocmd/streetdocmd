// TEMPORARY visual preview (not committed): provider calendar.
import Navbar from "@/components/Navbar";
import CalendarClient from "@/app/dashboard/calendar/CalendarClient";

export default function Preview() {
  const d = (offset: number, h: number) => { const x = new Date(); x.setDate(x.getDate() + offset); x.setHours(h, 0, 0, 0); return x.toISOString(); };
  const off = new Date(); off.setDate(off.getDate() + 3);
  return (
    <div className="min-h-screen flex flex-col bg-page">
      <Navbar providerName="Adaeze Okonkwo" specialty="General practice" profession="doctor" />
      <main className="flex-1 mx-auto w-full max-w-2xl px-5 pt-5 pb-28">
        <CalendarClient providerId="x" timeOffAvailable timeOff={[new Intl.DateTimeFormat("en-CA").format(off)]}
          visits={[
            { id: "1", at: d(0, 9), service: "Wound care", patient: "Ahmed Bello", area: "Ikeja", asap: false },
            { id: "2", at: d(0, 11), service: "General consultation", patient: "Mrs Ngozi", area: "Maryland", asap: false },
            { id: "3", at: d(1, 14), service: "Post surgical check", patient: "Amina Sule", area: "Surulere", asap: false },
            ...[9, 10, 11, 12].map(h => ({ id: `b${h}`, at: d(2, h), service: "General consultation", patient: "Patient", area: "Ikeja", asap: false })),
          ]} />
      </main>
    </div>
  );
}
