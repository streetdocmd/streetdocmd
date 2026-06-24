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
      .single();
    setVerified(data?.verification_status === "verified");
  }

  useEffect(() => {
    if (loading) return;
    const inAuth = segments[0] === "(auth)";
    if (!session && !inAuth) { router.replace("/(auth)/login"); return; }
    if (session && inAuth && segments[1] === "pending") return;
    if (session && verified === false && segments[1] !== "pending") {
      router.replace("/(auth)/pending"); return;
    }
    if (session && verified === true && inAuth) {
      router.replace("/(tabs)/dispatch");
    }
  }, [session, verified, loading, segments]);

  return <Slot />;
}