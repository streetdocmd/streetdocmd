"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Splash from "./Splash";

// Signed-out entry at "/": splash, then sign up. Returning visitors skip the
// splash on later launches and go straight to sign up, as before.
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
    // private mode or blocked storage: the splash simply shows again next time
  }
}

export default function WelcomeFlow() {
  const router = useRouter();

  useEffect(() => {
    if (hasSeenWelcome()) {
      router.replace("/register");
      return;
    }
    const t = setTimeout(() => {
      markWelcomeSeen();
      router.replace("/register");
    }, SPLASH_MS);
    return () => clearTimeout(t);
  }, [router]);

  return <Splash />;
}
