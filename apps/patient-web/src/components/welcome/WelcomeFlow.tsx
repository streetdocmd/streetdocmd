"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Splash from "./Splash";
import Onboarding from "./Onboarding";

// Signed-out entry at "/": splash, then three onboarding slides, then sign up
// (or sign in). Returning visitors skip both and go straight to sign up, as before.
const SEEN_KEY = "sdm_welcome_seen";
const SPLASH_MS = 2600;

function hasSeenWelcome() {
  try {
    return localStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

function markWelcomeSeen() {
  try {
    localStorage.setItem(SEEN_KEY, "1");
  } catch {
    // private mode or blocked storage: the welcome simply shows again next time
  }
}

export default function WelcomeFlow() {
  const router = useRouter();
  const [stage, setStage] = useState<"splash" | "onboarding">("splash");

  useEffect(() => {
    if (hasSeenWelcome()) {
      router.replace("/register");
      return;
    }
    router.prefetch("/register");
    const t = setTimeout(() => setStage("onboarding"), SPLASH_MS);
    return () => clearTimeout(t);
  }, [router]);

  if (stage === "splash") return <Splash />;
  return (
    <Onboarding
      onFinish={(href) => {
        markWelcomeSeen();
        router.push(href);
      }}
    />
  );
}
