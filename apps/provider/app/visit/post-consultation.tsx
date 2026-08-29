import { useEffect, useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, StyleSheet, ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Notifications from "expo-notifications";
import { supabase } from "../../lib/supabase";
import { SERVICE_PRICES, ELDERLY_FOLLOW_UP_SERVICE, calculateCommission, calculateNetPayout } from "@streetdocmd/shared";

type Step = "investigations" | "prescription" | "drugs" | "pharmacy" | "follow_up" | "completing" | "done";

interface Drug {
  drug_name: string;
  strength: string;
  frequency: string;
  duration: string;
}

const CONTROLLED = [
  "morphine", "codeine", "tramadol", "fentanyl", "oxycodone",
  "diazepam", "midazolam", "alprazolam", "clonazepam", "ketamine", "pethidine",
];

const EMPTY_DRUG: Drug = { drug_name: "", strength: "", frequency: "", duration: "" };

export default function PostConsultationScreen() {
  const { bookingId, visitId, patientId, fromLabs } = useLocalSearchParams<{
    bookingId: string; visitId: string; patientId: string; fromLabs?: string;
  }>();
  const router = useRouter();

  const [step, setStep]       = useState<Step>(fromLabs === "1" ? "prescription" : "investigations");
  const [drugs, setDrugs]     = useState<Drug[]>([{ ...EMPTY_DRUG }]);
  const [busy, setBusy]       = useState(false);
  const [fieldError, setFieldError] = useState("");
  const [serviceType, setServiceType] = useState<string | null>(null);

  useEffect(() => {
    supabase.from("bookings").select("service_type").eq("id", bookingId).single()
      .then(({ data }) => setServiceType(data?.service_type ?? null));
  }, [bookingId]);

  // Elderly-review visits get an extra "request nurse follow-up" prompt
  // before the visit is finalised.
  function proceedToFinish() {
    if (serviceType === "elderly_review") {
      setStep("follow_up");
    } else {
      finishVisit();
    }
  }

  async function requestFollowUp() {
    setBusy(true);
    const fee = SERVICE_PRICES[ELDERLY_FOLLOW_UP_SERVICE];
    const { error } = await supabase.rpc("create_elderly_follow_up_booking", {
      p_original_booking_id: bookingId,
      p_fee: fee,
      p_commission: calculateCommission(fee),
      p_net_payout: calculateNetPayout(fee),
    });
    setBusy(false);
    if (error) { setFieldError("Could not request follow-up. Please try again."); return; }
    setFieldError("");
    finishVisit();
  }

  // ─── Drug helpers ────────────────────────────────────────────────
  function updateDrug(i: number, field: keyof Drug, val: string) {
    setDrugs(prev => prev.map((d, idx) => idx === i ? { ...d, [field]: val } : d));
  }
  function addDrug()         { setDrugs(prev => [...prev, { ...EMPTY_DRUG }]); }
  function removeDrug(i: number) { setDrugs(prev => prev.filter((_, idx) => idx !== i)); }

  // ─── Save prescription ───────────────────────────────────────────
  async function savePrescription() {
    const validDrugs = drugs.filter(d => d.drug_name.trim());
    if (!validDrugs.length) { setFieldError("Enter at least one drug name."); return; }
    setFieldError("");
    setBusy(true);

    const { data: { user } } = await supabase.auth.getUser();
    const { data: provider }  = await supabase.from("providers")
      .select("id").eq("user_id", user!.id).single();

    const { error } = await supabase.from("prescriptions").insert({
      visit_id: visitId, booking_id: bookingId,
      patient_id: patientId, provider_id: provider!.id,
      drugs: validDrugs,
    });

    setBusy(false);
    if (error) { setFieldError("Could not save prescription. Try again."); return; }
    setStep("pharmacy");
  }

  // ─── Send to pharmacy ────────────────────────────────────────────
  async function sendToPharmacy() {
    setBusy(true);
    const { data: { user } }  = await supabase.auth.getUser();
    const { data: provider }  = await supabase.from("providers")
      .select("id").eq("user_id", user!.id).single();
    const { data: pharmacy }  = await supabase.from("pharmacy_partners")
      .select("id").eq("active", true).limit(1).single();

    if (pharmacy) {
      const validDrugs     = drugs.filter(d => d.drug_name.trim());
      const requiresReview = validDrugs.some(d =>
        CONTROLLED.some(k => d.drug_name.toLowerCase().includes(k))
      );
      await supabase.from("prescription_orders").insert({
        patient_id: patientId, provider_id: provider!.id,
        pharmacy_partner_id: pharmacy.id, visit_id: visitId,
        drugs: validDrugs, status: "sent",
        requires_review: requiresReview,
        payment_status: "pending", total_amount: 0, commission_amount: 0,
      });
    }
    setBusy(false);
    proceedToFinish();
  }

  // ─── Finish visit ────────────────────────────────────────────────
  async function finishVisit() {
    setStep("completing");

    const { data: { user } } = await supabase.auth.getUser();
    const { data: provider } = await supabase.from("providers")
      .select("id, name, wallet_balance").eq("user_id", user!.id).single();
    const { data: booking }  = await supabase.from("bookings")
      .select("net_payout").eq("id", bookingId).single();

    // Mark booking complete
    await supabase.from("bookings").update({
      status: "completed", completed_at: new Date().toISOString(),
    }).eq("id", bookingId);

    // Credit provider wallet
    const payout = booking?.net_payout ?? 0;
    if (payout > 0 && provider) {
      await supabase.from("providers").update({
        wallet_balance: (provider.wallet_balance ?? 0) + payout,
      }).eq("id", provider.id);
    }

    // Notify patient
    const { data: patient } = await supabase.from("users")
      .select("push_token, name").eq("id", patientId).single();

    if (patient?.push_token?.startsWith("ExponentPushToken")) {
      fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          to: patient.push_token,
          title: "Visit Complete",
          body: `Your home visit with Dr ${provider?.name ?? "your doctor"} is complete. View your records.`,
          sound: "default",
          data: { screen: "records" },
        }),
      }).catch(() => {});
    }

    // Schedule 24h follow-up reminder for provider
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "Follow-up Reminder",
          body: `Check in with ${patient?.name ?? "your patient"} from today's visit.`,
          sound: true,
        },
        trigger: { seconds: 86400 } as any,
      });
    } catch {}

    setStep("done");
  }

  // ─── Render ──────────────────────────────────────────────────────
  return (
    <ScrollView style={s.container} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">

      {/* STEP: Investigations */}
      {step === "investigations" && (
        <PromptCard
          emoji="🔬"
          badge="Step 1 of 2"
          title="Does this patient need any investigations?"
          subtitle="Lab tests, imaging or other diagnostic workup"
          primaryLabel="Order Investigations"
          primaryColor="#7C3AED"
          onPrimary={() =>
            router.push({
              pathname: "/labs/order",
              params: { bookingId, patientId, visitId, returnTo: "post-consultation" },
            })
          }
          skipLabel="No, skip to prescription"
          onSkip={() => setStep("prescription")}
        />
      )}

      {/* STEP: Prescription prompt */}
      {step === "prescription" && (
        <PromptCard
          emoji="💊"
          badge="Step 2 of 2"
          title="Do you want to generate a prescription?"
          subtitle="Prescribe medications for the patient to take at home"
          primaryLabel="Yes, write prescription"
          primaryColor="#059669"
          onPrimary={() => setStep("drugs")}
          skipLabel="No, finish visit"
          onSkip={proceedToFinish}
          disabled={busy}
        />
      )}

      {/* STEP: Drug entry */}
      {step === "drugs" && (
        <View>
          <Text style={s.heading}>Prescription</Text>
          <Text style={s.subheading}>Add all medications for this patient</Text>

          {drugs.map((drug, i) => (
            <View key={i} style={s.drugCard}>
              <View style={s.drugHeader}>
                <Text style={s.drugNum}>Drug {i + 1}</Text>
                {drugs.length > 1 && (
                  <TouchableOpacity onPress={() => removeDrug(i)}>
                    <Text style={s.removeText}>Remove</Text>
                  </TouchableOpacity>
                )}
              </View>
              <DrugField label="Drug Name *"       value={drug.drug_name}  onChange={v => updateDrug(i, "drug_name", v)}  placeholder="e.g. Amoxicillin" />
              <DrugField label="Strength / Dosage" value={drug.strength}   onChange={v => updateDrug(i, "strength", v)}   placeholder="e.g. 500mg" />
              <DrugField label="Frequency"         value={drug.frequency}  onChange={v => updateDrug(i, "frequency", v)}  placeholder="e.g. 3 times daily after meals" />
              <DrugField label="Duration"          value={drug.duration}   onChange={v => updateDrug(i, "duration", v)}   placeholder="e.g. 7 days" />
            </View>
          ))}

          <TouchableOpacity style={s.addDrugBtn} onPress={addDrug}>
            <Text style={s.addDrugText}>+ Add another drug</Text>
          </TouchableOpacity>

          {fieldError ? <Text style={s.errorText}>{fieldError}</Text> : null}

          <TouchableOpacity
            style={[s.btn, { backgroundColor: "#059669" }, busy && s.btnDisabled]}
            onPress={savePrescription}
            disabled={busy}
          >
            {busy
              ? <ActivityIndicator color="#fff" />
              : <Text style={s.btnText}>Generate Prescription →</Text>
            }
          </TouchableOpacity>
        </View>
      )}

      {/* STEP: Pharmacy prompt */}
      {step === "pharmacy" && (
        <PromptCard
          emoji="🛵"
          badge="Prescription Generated ✓"
          title="Send to pharmacy for home delivery?"
          subtitle="Patient will pay online and receive their medications delivered to their door"
          primaryLabel="Yes, arrange home delivery"
          primaryColor="#0369A1"
          onPrimary={sendToPharmacy}
          skipLabel="No, finish visit"
          onSkip={proceedToFinish}
          disabled={busy}
        />
      )}

      {/* STEP: Nurse follow-up (elderly review only) */}
      {step === "follow_up" && (
        <PromptCard
          emoji="🧑‍⚕️"
          badge="Before you finish"
          title="Does this patient need a nurse follow-up visit?"
          subtitle="Based on your diagnosis, request a nurse to visit this patient for follow-up care"
          primaryLabel="Yes, request nurse follow-up"
          primaryColor="#0D9488"
          onPrimary={requestFollowUp}
          skipLabel="No, finish visit"
          onSkip={finishVisit}
          disabled={busy}
        />
      )}

      {/* STEP: Completing */}
      {step === "completing" && (
        <View style={s.center}>
          <ActivityIndicator size="large" color="#059669" />
          <Text style={s.completingTitle}>Finalising visit…</Text>
          <Text style={s.completingSub}>Updating wallet · Notifying patient · Scheduling follow-up</Text>
        </View>
      )}

      {/* STEP: Done */}
      {step === "done" && (
        <View style={s.center}>
          <Text style={s.doneEmoji}>✅</Text>
          <Text style={s.doneTitle}>Visit Complete!</Text>
          <Text style={s.doneSub}>
            Patient has been notified and your wallet has been credited.{"\n"}
            A follow-up reminder is set for 24 hours.
          </Text>
          <TouchableOpacity
            style={[s.btn, { backgroundColor: "#059669", marginTop: 36 }]}
            onPress={() => router.replace("/(tabs)/dispatch")}
          >
            <Text style={s.btnText}>Back to Dashboard</Text>
          </TouchableOpacity>
        </View>
      )}

    </ScrollView>
  );
}

// ─── Reusable prompt card ────────────────────────────────────────────────────
function PromptCard({
  emoji, badge, title, subtitle,
  primaryLabel, primaryColor, onPrimary,
  skipLabel, onSkip, disabled,
}: {
  emoji: string; badge: string; title: string; subtitle: string;
  primaryLabel: string; primaryColor: string; onPrimary: () => void;
  skipLabel: string; onSkip: () => void; disabled?: boolean;
}) {
  return (
    <View style={s.promptCard}>
      <Text style={s.badge}>{badge}</Text>
      <Text style={s.promptEmoji}>{emoji}</Text>
      <Text style={s.promptTitle}>{title}</Text>
      <Text style={s.promptSub}>{subtitle}</Text>
      <TouchableOpacity
        style={[s.btn, { backgroundColor: primaryColor }, disabled && s.btnDisabled]}
        onPress={onPrimary}
        disabled={disabled}
      >
        <Text style={s.btnText}>{primaryLabel}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={s.skipBtn} onPress={onSkip} disabled={disabled}>
        <Text style={s.skipText}>{skipLabel}</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Drug form field ─────────────────────────────────────────────────────────
function DrugField({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder: string;
}) {
  return (
    <View style={{ marginBottom: 10 }}>
      <Text style={s.fieldLabel}>{label}</Text>
      <TextInput
        style={s.fieldInput}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor="#9CA3AF"
      />
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container:  { flex: 1, backgroundColor: "#F9FAFB" },
  content:    { padding: 20, paddingBottom: 60 },

  // Prompt card
  promptCard: {
    backgroundColor: "#fff", borderRadius: 20, padding: 28,
    borderWidth: 1, borderColor: "#E5E7EB",
    alignItems: "center", marginTop: 32,
  },
  badge:      { fontSize: 11, fontWeight: "700", color: "#6B7280", textTransform: "uppercase", letterSpacing: 1, marginBottom: 16 },
  promptEmoji:{ fontSize: 52, marginBottom: 16 },
  promptTitle:{ fontSize: 19, fontWeight: "700", color: "#111827", textAlign: "center", marginBottom: 8 },
  promptSub:  { fontSize: 14, color: "#6B7280", textAlign: "center", lineHeight: 21, marginBottom: 28 },

  // Buttons
  btn: { width: "100%", borderRadius: 12, paddingVertical: 16, alignItems: "center", marginBottom: 10 },
  btnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  btnDisabled: { opacity: 0.5 },
  skipBtn: { paddingVertical: 12, width: "100%", alignItems: "center" },
  skipText: { color: "#9CA3AF", fontSize: 14 },

  // Drug form
  heading:    { fontSize: 20, fontWeight: "bold", color: "#111827", marginBottom: 4 },
  subheading: { fontSize: 13, color: "#6B7280", marginBottom: 20 },
  drugCard: {
    backgroundColor: "#fff", borderRadius: 12, padding: 16,
    borderWidth: 1, borderColor: "#E5E7EB", marginBottom: 12,
  },
  drugHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  drugNum:    { fontSize: 13, fontWeight: "700", color: "#374151" },
  removeText: { fontSize: 13, color: "#EF4444" },
  addDrugBtn: {
    borderWidth: 1.5, borderStyle: "dashed", borderColor: "#D1D5DB",
    borderRadius: 10, paddingVertical: 14, alignItems: "center", marginBottom: 20,
  },
  addDrugText: { fontSize: 14, color: "#059669", fontWeight: "600" },
  fieldLabel: { fontSize: 11, fontWeight: "600", color: "#6B7280", marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.3 },
  fieldInput: {
    backgroundColor: "#F9FAFB", borderWidth: 1, borderColor: "#E5E7EB",
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14, color: "#111827",
  },
  errorText: { color: "#EF4444", fontSize: 13, marginBottom: 12 },

  // Completing / Done
  center:          { alignItems: "center", paddingTop: 80, paddingHorizontal: 20 },
  completingTitle: { fontSize: 18, fontWeight: "700", color: "#111827", marginTop: 20 },
  completingSub:   { fontSize: 13, color: "#6B7280", marginTop: 8, textAlign: "center", lineHeight: 20 },
  doneEmoji:  { fontSize: 64, marginBottom: 16 },
  doneTitle:  { fontSize: 26, fontWeight: "bold", color: "#059669", marginBottom: 10 },
  doneSub:    { fontSize: 14, color: "#6B7280", textAlign: "center", lineHeight: 22 },
});
