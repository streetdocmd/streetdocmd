"use client";
import { useState } from "react";

type Step = "idle" | "confirm" | "sending" | "sent";

export default function EmergencyButton() {
  const [step, setStep] = useState<Step>("idle");
  const [error, setError] = useState("");

  async function triggerSOS() {
    setStep("sending");
    setError("");

    let lat: number | undefined, lng: number | undefined;
    try {
      const pos = await new Promise<GeolocationPosition>((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej, { timeout: 5000 })
      );
      lat = pos.coords.latitude;
      lng = pos.coords.longitude;
    } catch {
      // Send SOS even without location
    }

    const res = await fetch("/api/emergency", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lat, lng }),
    });

    if (!res.ok) {
      setError("Alert failed. Call +234 800 000 0000 directly.");
      setStep("confirm");
      return;
    }
    setStep("sent");
  }

  if (step === "sent") {
    return (
      <div className="rounded-xl border-2 border-red-400 bg-red-50 p-5 text-center">
        <p className="text-3xl mb-2">🚨</p>
        <p className="font-bold text-red-700 text-lg">Help is on the way</p>
        <p className="text-sm text-red-600 mt-1">
          Our emergency response team has been alerted and will call you shortly.
        </p>
        <p className="text-xs text-red-400 mt-3">
          Also call{" "}
          <a href="tel:+2348000000000" className="underline font-semibold">
            +234 800 000 0000
          </a>{" "}
          if needed.
        </p>
      </div>
    );
  }

  if (step === "confirm" || step === "sending") {
    return (
      <div className="rounded-xl border-2 border-red-500 bg-red-50 p-5">
        <p className="font-bold text-red-700 text-lg mb-1">🚨 Confirm Emergency SOS</p>
        <p className="text-sm text-red-600 mb-4">
          This immediately alerts our response team and shares your location. Only use for real emergencies.
        </p>
        {error && <p className="text-xs font-semibold text-red-700 mb-3">{error}</p>}
        <div className="flex gap-3">
          <button
            onClick={triggerSOS}
            disabled={step === "sending"}
            className="flex-1 py-3 bg-red-600 text-white rounded-lg font-bold text-sm hover:bg-red-700 transition-colors disabled:opacity-60"
          >
            {step === "sending" ? "Sending SOS…" : "Yes — Send SOS Now"}
          </button>
          <button
            onClick={() => { setStep("idle"); setError(""); }}
            disabled={step === "sending"}
            className="flex-1 py-3 bg-white text-gray-700 border border-gray-200 rounded-lg font-medium text-sm hover:bg-gray-50 transition-colors disabled:opacity-60"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-4 flex items-center justify-between gap-4">
      <div>
        <p className="font-semibold text-red-700">🚨 Medical Emergency?</p>
        <p className="text-sm text-red-500 mt-0.5">Alert our response team instantly</p>
      </div>
      <button
        onClick={() => setStep("confirm")}
        className="shrink-0 bg-red-600 text-white px-6 py-2.5 rounded-lg text-sm font-bold hover:bg-red-700 transition-colors"
      >
        SOS
      </button>
    </div>
  );
}