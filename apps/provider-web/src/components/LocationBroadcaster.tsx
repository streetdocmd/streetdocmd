"use client";
import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase";

export default function LocationBroadcaster({ providerId }: { providerId: string }) {
  const lastPush = useRef(0);

  useEffect(() => {
    if (!navigator.geolocation) return;

    const supabase = createClient();

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const now = Date.now();
        if (now - lastPush.current < 10_000) return; // throttle to every 10s
        lastPush.current = now;

        supabase
          .from("providers")
          .update({ lat: pos.coords.latitude, lng: pos.coords.longitude })
          .eq("id", providerId)
          .then(() => {});
      },
      null,
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 15_000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [providerId]);

  return null;
}