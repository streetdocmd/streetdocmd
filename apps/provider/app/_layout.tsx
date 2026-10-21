import { Slot, useRouter, useSegments } from "expo-router";
import { useEffect, useState } from "react";
import { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null);
  const [verified, setVerified] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      if (session) await checkVerification(session.user.id);
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_e, s) => {
      setSession(s);
      if (s) await checkVerification(s.user.id);
      else setVerified(null);
    });
    return () => subscription.unsubscribe();
  }, []);

  async function checkVerification(userId: string) {
    const { data } = await supabase
      .from("providers")
      .select("verification_status")
      .eq("user_id", userId)
      .maybeSingle();
    setVerified(data?.verification_status === "verified");
  }

  useEffect(() => {
    if (loading) return;
    const inAuth = segments[0] === "(auth)";
    const screen = segments[1] as string | undefined;
    if (!session) {
      if (!inAuth) router.replace("/(auth)/login");
      return;
    }
    // Password-recovery links sign the user in — let them finish resetting.
    if (screen === "reset-password") return;
    if (verified === null) return; // still checking
    if (verified === false) {
      // Unverified (pending, under review, rejected, or no provider row yet):
      // the pending screen explains which of those it is and what to do next.
      if (screen !== "pending") router.replace("/(auth)/pending");
      return;
    }
    if (inAuth) router.replace("/(tabs)/dispatch");
  }, [session, verified, loading, segments]);

  return <Slot />;
}