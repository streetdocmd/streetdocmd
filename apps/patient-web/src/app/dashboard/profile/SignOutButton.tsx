"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { Button } from "@/components/ds";

// Same sign out as the account menu
export default function SignOutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function signOut() {
    setBusy(true);
    await createClient().auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <Button variant="secondary" block onClick={signOut} disabled={busy} className="mt-5">
      <LogOut size={18} aria-hidden /> {busy ? "Signing out…" : "Sign out"}
    </Button>
  );
}
