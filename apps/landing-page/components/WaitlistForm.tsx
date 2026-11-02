"use client";

import { useState, type FormEvent } from "react";
import { LINKS } from "@/lib/links";
import { WAITLIST_ROLES } from "@/lib/waitlist";

type Status = "idle" | "sending" | "done" | "error";

export default function WaitlistForm() {
  const [status, setStatus] = useState<Status>("idle");

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("sending");
    const res = await fetch("/api/waitlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(new FormData(e.currentTarget))),
    }).catch(() => null);
    setStatus(res?.ok ? "done" : "error");
  }

  if (status === "done") {
    return (
      <div className="contact-form contact-success" role="status">
        <h3>You’re on the waitlist.</h3>
        <p>Thank you. We’ll be in touch using the details you gave us.</p>
      </div>
    );
  }

  return (
    <form className="contact-form" onSubmit={submit}>
      <div className="contact-row">
        <div className="contact-field">
          <label htmlFor="wl-name">Full Name</label>
          <input id="wl-name" name="full_name" required maxLength={120} autoComplete="name" placeholder="e.g. John Doe" />
        </div>
        <div className="contact-field">
          <label htmlFor="wl-email">Email</label>
          <input id="wl-email" name="email" type="email" required maxLength={254} autoComplete="email" placeholder="you@example.com" />
        </div>
      </div>

      <div className="contact-row">
        <div className="contact-field">
          <label htmlFor="wl-phone">Phone Number</label>
          <input id="wl-phone" name="phone" type="tel" maxLength={30} autoComplete="tel" placeholder="+234 800 000 000" />
        </div>
        <div className="contact-field">
          <label htmlFor="wl-city">Location (City)</label>
          <input id="wl-city" name="city" maxLength={100} autoComplete="address-level2" placeholder="e.g. Lagos" />
        </div>
      </div>

      <div className="contact-field">
        <label htmlFor="wl-role">I am a</label>
        <div className="contact-select">
          <select id="wl-role" name="role" required defaultValue="">
            <option value="" disabled>Select one......</option>
            {WAITLIST_ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
          <img src="/images/contact-caret.svg" alt="" width={24} height={24} />
        </div>
      </div>

      <div className="contact-field">
        <label htmlFor="wl-message">Anything you’d like us to know</label>
        <textarea id="wl-message" name="message" maxLength={2000} />
      </div>

      {/* Hidden from people; see the route */}
      <div className="contact-hp" aria-hidden="true">
        <label htmlFor="wl-website">Website</label>
        <input id="wl-website" name="website" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="contact-actions">
        {status === "error" && (
          <p className="contact-error" role="alert">
            We couldn’t save your details just now. Please try again, or email{" "}
            <a href="mailto:contact@streetdocmd.com">contact@streetdocmd.com</a>.
          </p>
        )}
        <button type="submit" className="btn btn-primary contact-submit" disabled={status === "sending"}>
          {status === "sending" ? "Joining…" : "Join the waitlist"}
        </button>
        <p className="contact-note">
          We’ll only use these details to contact you about StreetdocMD. Read our{" "}
          <a href={LINKS.privacy}>Privacy Policy</a>.
        </p>
      </div>
    </form>
  );
}
