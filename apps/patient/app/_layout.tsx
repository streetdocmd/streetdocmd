import { Slot, useRouter, useSegments } from "expo-router";
import { useEffect, useState } from "react";
import { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { ensurePatientProfile, onProfileChanged } from "../lib/profile";

type ProfileState = "unknown" | "present" | "missing";

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<ProfileState>("unknown");
  const [profileError, setProfileError] = useState<string | undefined>();
  const [recheck, setRecheck] = useState(0);
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    const off = onProfileChanged(() => setRecheck(n => n + 1));
    return () => { subscription.unsubscribe(); off(); };
  }, []);

  const userId = session?.user.id;

  // Make sure a signed-in user has their patient profile row before they
  // reach any screen that depends on it.
  useEffect(() => {
    if (!session) { setProfile("unknown"); return; }
    let cancelled = false;
    ensurePatientProfile(session).then(res => {
      if (cancelled) return;
      setProfile(res.status);
      setProfileError(res.status === "missing" ? res.error : undefined);
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, recheck]);

  useEffect(() => {
    if (loading) return;
    const inAuth = segments[0] === "(auth)";
    const inSetup = segments[0] === "complete-profile";
    if (!session) {
      if (!inAuth) router.replace("/(auth)/login");
      return;
    }
    if (profile === "unknown") return;
    if (profile === "missing" && !inSetup) {
      router.replace({ pathname: "/complete-profile", params: profileError ? { error: profileError } : {} });
      return;
    }
    if (profile === "present" && (inAuth || inSetup)) router.replace("/(tabs)/home");
  }, [session, loading, segments, profile, profileError]);

  // Always render the Slot: expo-router needs the navigator mounted before
  // any router.replace() above runs.
  return <Slot />;
}
