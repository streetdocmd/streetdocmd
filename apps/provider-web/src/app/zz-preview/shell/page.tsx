// TEMPORARY visual preview (not committed): provider shell.
import Navbar from "@/components/Navbar";
import { Button, Card, Pill, Toggle } from "@/components/ds";

export default function Preview() {
  return (
    <div className="min-h-screen flex flex-col bg-page">
      <Navbar providerName="Adaeze Okonkwo" specialty="General practice" profession="doctor" />
      <main className="flex-1 max-w-6xl mx-auto w-full px-5 pt-5 pb-28">
        <Card><Pill tone="teal">Doctor</Pill><p className="mt-3 text-ds-sm">Legacy <span className="badge bg-accent-soft text-accent">badge</span></p></Card>
        <div className="mt-4 flex gap-2"><Button>Primary teal</Button><button className="btn-secondary">Legacy secondary</button></div>
        <input className="input mt-4" placeholder="Legacy input" />
      </main>
    </div>
  );
}
