"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Onboarding from "./Onboarding";

// Signed-out entry at "/": three onboarding slides, then sign up (or sign in).
// Returning visitors skip them and go straight to sign up, as before.
const SEEN_KEY = "sdm_welcome_seen";

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
  const [firstVisit, setFirstVisit] = useState(false);

  useEffect(() => {
    if (hasSeenWelcome()) {
      router.replace("/register");
      return;
    }
    router.prefetch("/register");
    setFirstVisit(true);
  }, [router]);

  if (!firstVisit) return null;
  return (
    <Onboarding
      onFinish={(href) => {
        markWelcomeSeen();
        router.push(href);
      }}
    />
  );
}
