import { useState } from "react";
import {
  Modal, View, Text, TouchableOpacity, StyleSheet, ScrollView, SafeAreaView, Platform, ActivityIndicator,
} from "react-native";
import LegalAcceptanceFields, { type LegalAcceptanceValue } from "./LegalAcceptanceFields";
import { recordLegalAcceptance, TERMS_VERSION } from "../lib/legal";

// Home-screen card for a patient who hasn't accepted the current Patient
// Terms of Service / acknowledged the current Privacy Policy (every account
// from before v2.0). A persistent prompt, not a gate: it stays until they
// tick the same two separate boxes as at sign-up.
export default function LegalUpdatePrompt({
  firstTime,
  onAccepted,
}: {
  firstTime?: boolean;
  onAccepted: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [legal, setLegal] = useState<LegalAcceptanceValue>({ terms: false, privacy: false });
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const legalOk = legal.terms && legal.privacy;

  function openSheet() {
    // Every review starts unticked.
    setLegal({ terms: false, privacy: false });
    setSubmitted(false);
    setError("");
    setOpen(true);
  }

  async function accept() {
    if (saving) return;
    setSubmitted(true);
    if (!legalOk) return;
    setSaving(true);
    setError("");
    const res = await recordLegalAcceptance("reaccept");
    setSaving(false);
    if (!res.ok) { setError(res.error ?? "Something went wrong. Please try again."); return; }
    setOpen(false);
    onAccepted();
  }

  return (
    <>
      <TouchableOpacity style={styles.card} onPress={openSheet} activeOpacity={0.8}>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>
            {firstTime ? "Please review our Terms and Privacy Policy" : "We've updated our Terms and Privacy Policy"}
          </Text>
          <Text style={styles.cardSub}>
            Read and accept the Patient Terms of Service and acknowledge the Privacy Policy (version {TERMS_VERSION}).
          </Text>
        </View>
        <Text style={styles.cardCta}>Review</Text>
      </TouchableOpacity>

      <Modal
        visible={open}
        animationType="slide"
        presentationStyle={Platform.OS === "ios" ? "pageSheet" : undefined}
        onRequestClose={() => { if (!saving) setOpen(false); }}
      >
        <SafeAreaView style={styles.safe}>
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.brand}>STREETDOCMD</Text>
              <Text style={styles.title}>{"Terms & Privacy Policy"}</Text>
              <Text style={styles.subtitle}>Version {TERMS_VERSION}</Text>
            </View>
            <TouchableOpacity
              onPress={() => setOpen(false)}
              disabled={saving}
              style={styles.closeBtn}
              accessibilityLabel="Close"
              hitSlop={8}
            >
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.body}>
            <Text style={styles.intro}>
              Tap Read to open each document in full, then tick both boxes to continue.
            </Text>
            <LegalAcceptanceFields
              value={legal}
              onChange={next => { setLegal(next); if (next.terms && next.privacy) setError(""); }}
              showErrors={submitted}
            />
            {error ? <Text style={styles.errorBox}>{error}</Text> : null}
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity style={styles.laterBtn} onPress={() => setOpen(false)} disabled={saving}>
              <Text style={styles.laterText}>Not now</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, (!legalOk || saving) && styles.btnDisabled]}
              onPress={accept}
              disabled={!legalOk || saving}
            >
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Continue</Text>}
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#FFFBEB", borderWidth: 1, borderColor: "#FDE68A", borderRadius: 12,
    padding: 14, marginBottom: 20, flexDirection: "row", alignItems: "center", gap: 10,
  },
  cardTitle: { fontSize: 14, fontWeight: "600", color: "#111827" },
  cardSub: { fontSize: 12, color: "#4B5563", marginTop: 2, lineHeight: 17 },
  cardCta: { fontSize: 13, fontWeight: "700", color: "#B45309" },
  safe: { flex: 1, backgroundColor: "#fff" },
  header: {
    backgroundColor: "#0D2B5E", paddingHorizontal: 20, paddingTop: 18, paddingBottom: 16,
    flexDirection: "row", alignItems: "flex-start", gap: 12,
  },
  brand: { fontSize: 11, fontWeight: "700", color: "#BFDBFE", letterSpacing: 0.6 },
  title: { fontSize: 19, fontWeight: "700", color: "#fff", marginTop: 4 },
  subtitle: { fontSize: 12, color: "#BFDBFE", marginTop: 2 },
  closeBtn: {
    width: 34, height: 34, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center", justifyContent: "center",
  },
  closeText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  body: { padding: 20 },
  intro: { fontSize: 14, color: "#4B5563", lineHeight: 20, marginBottom: 16 },
  errorBox: {
    backgroundColor: "#FEF2F2", borderWidth: 1, borderColor: "#FECACA", color: "#B91C1C",
    borderRadius: 10, padding: 12, fontSize: 13, overflow: "hidden",
  },
  footer: {
    flexDirection: "row", gap: 10, borderTopWidth: 1, borderTopColor: "#F3F4F6",
    paddingHorizontal: 20, paddingVertical: 12,
  },
  laterBtn: {
    flex: 1, borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 10,
    paddingVertical: 14, alignItems: "center",
  },
  laterText: { color: "#374151", fontWeight: "600", fontSize: 15 },
  btn: { flex: 2, backgroundColor: "#1E6FD9", borderRadius: 10, paddingVertical: 14, alignItems: "center" },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: "#fff", fontWeight: "600", fontSize: 15 },
});
