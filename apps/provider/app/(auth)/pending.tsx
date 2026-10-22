import { useCallback, useEffect, useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Linking, ScrollView, RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { getPractitionerType } from "@streetdocmd/shared";
import { supabase } from "../../lib/supabase";
import { PROVIDER_PORTAL_URL } from "../../lib/config";

type State =
  | { kind: "loading" }
  | { kind: "no_profile" }
  | { kind: "needs_documents"; missing: string[] }
  | { kind: "in_review"; underReview: boolean }
  | { kind: "rejected"; reason: string | null };

const DOC_LABELS: Record<string, string> = {
  certificate: "University / degree certificate",
  mdcn_licence: "MDCN practising licence",
  nmcn_licence: "NMCN practising licence",
  mrtb_licence: "MRTB practising licence",
  mlscn_licence: "MLSCN practising licence",
};

export default function PendingScreen() {
  const router = useRouter();
  const [state, setState] = useState<State>({ kind: "loading" });
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.replace("/(auth)/login"); return; }

    const { data: provider } = await supabase
      .from("providers")
      .select("id, specialty, verification_status, rejection_reason")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!provider) { setState({ kind: "no_profile" }); return; }

    if (provider.verification_status === "verified") {
      // The root layout routes from its own cached status — a session
      // refresh makes it re-read the (now verified) row and open the app.
      setState({ kind: "in_review", underReview: true });
      await supabase.auth.refreshSession();
      return;
    }
    if (provider.verification_status === "rejected") {
      setState({ kind: "rejected", reason: provider.rejection_reason });
      return;
    }
    if (provider.verification_status === "under_review") {
      setState({ kind: "in_review", underReview: true });
      return;
    }

    const { data: docs } = await supabase
      .from("provider_documents")
      .select("document_type")
      .eq("provider_id", provider.id);
    const have = (docs ?? []).map(d => d.document_type as string);
    const practitionerType = getPractitionerType(provider.specialty);
    const required = practitionerType ? ["certificate", practitionerType.licenceDocType] : ["certificate"];
    const missing = required.filter(t => !have.includes(t));
    setState(missing.length > 0 ? { kind: "needs_documents", missing } : { kind: "in_review", underReview: false });
  }, [router]);

  useEffect(() => { load(); }, [load]);

  async function refresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function logout() {
    await supabase.auth.signOut();
    router.replace("/(auth)/login");
  }

  function openPortal(path: string) {
    Linking.openURL(`${PROVIDER_PORTAL_URL}${path}`).catch(() => {});
  }

  if (state.kind === "loading") {
    return <View style={[styles.container, styles.center]}><ActivityIndicator size="large" color="#fff" /></View>;
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scroll}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor="#fff" />}
    >
      <View style={styles.card}>
        {state.kind === "no_profile" && (
          <>
            <Text style={styles.icon}>⚠️</Text>
            <Text style={styles.title}>Finish your application</Text>
            <Text style={styles.body}>
              You're signed in, but we couldn't find your provider details. Please complete your registration
              on the provider portal using the same email and password.
            </Text>
            <TouchableOpacity style={styles.primaryBtn} onPress={() => openPortal("/register/individual")}>
              <Text style={styles.primaryBtnText}>Complete registration</Text>
            </TouchableOpacity>
          </>
        )}

        {state.kind === "needs_documents" && (
          <>
            <Text style={styles.icon}>📄</Text>
            <Text style={styles.title}>Upload your documents</Text>
            <Text style={styles.body}>
              Your account is created. To finish your application, sign in to the provider portal with the same
              email and password and upload:
            </Text>
            <View style={styles.steps}>
              {state.missing.map(t => <Step key={t} done={false} text={DOC_LABELS[t] ?? t} />)}
            </View>
            <TouchableOpacity style={styles.primaryBtn} onPress={() => openPortal("/login")}>
              <Text style={styles.primaryBtnText}>Open provider portal</Text>
            </TouchableOpacity>
            <Text style={styles.hint}>{PROVIDER_PORTAL_URL.replace(/^https?:\/\//, "")}</Text>
          </>
        )}

        {state.kind === "in_review" && (
          <>
            <Text style={styles.icon}>🕐</Text>
            <Text style={styles.title}>Application under review</Text>
            <Text style={styles.body}>
              Thank you for applying to join StreetdocMD. Our team is verifying your credentials — usually within
              24–48 hours. We'll email you once your account is approved.
            </Text>
            <View style={styles.steps}>
              <Step done text="Application submitted" />
              <Step done={false} active={state.underReview} text="Credentials verified by StreetdocMD team" />
              <Step done={false} text="Account activated — start receiving bookings" />
            </View>
          </>
        )}

        {state.kind === "rejected" && (
          <>
            <Text style={styles.icon}>📝</Text>
            <Text style={styles.title}>Your application needs changes</Text>
            <Text style={styles.body}>
              Our team couldn't verify your application as submitted. Please upload corrected documents on the
              provider portal and re-submit.
            </Text>
            <View style={styles.reasonBox}>
              <Text style={styles.reasonLabel}>Note from the verification team</Text>
              <Text style={styles.reasonText}>
                {state.reason || "No reason was recorded — please email contact@streetdocmd.com."}
              </Text>
            </View>
            <TouchableOpacity style={styles.primaryBtn} onPress={() => openPortal("/login")}>
              <Text style={styles.primaryBtnText}>Update documents</Text>
            </TouchableOpacity>
          </>
        )}

        <TouchableOpacity style={styles.btn} onPress={refresh} disabled={refreshing}>
          <Text style={styles.btnText}>{refreshing ? "Checking…" : "Check status"}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={logout} style={styles.linkBtn}>
          <Text style={styles.linkText}>Sign out</Text>
        </TouchableOpacity>
        <Text style={styles.hint}>Questions? contact@streetdocmd.com</Text>
      </View>
    </ScrollView>
  );
}

function Step({ done, active = false, text }: { done: boolean; active?: boolean; text: string }) {
  return (
    <View style={styles.step}>
      <View style={[styles.dot, done && styles.dotDone, active && styles.dotActive]}>
        {done && <Text style={styles.dotCheck}>✓</Text>}
      </View>
      <Text style={[styles.stepText, (done || active) && styles.stepTextDone]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#064E3B" },
  center: { justifyContent: "center", alignItems: "center" },
  scroll: { flexGrow: 1, justifyContent: "center", padding: 20, paddingVertical: 48 },
  card: { backgroundColor: "#fff", borderRadius: 16, padding: 28, gap: 16 },
  icon: { fontSize: 44, textAlign: "center" },
  title: { fontSize: 20, fontWeight: "700", color: "#064E3B", textAlign: "center" },
  body: { fontSize: 14, color: "#6B7280", lineHeight: 22, textAlign: "center" },
  steps: { gap: 12, marginVertical: 4 },
  step: { flexDirection: "row", alignItems: "center", gap: 12 },
  dot: {
    width: 24, height: 24, borderRadius: 12, borderWidth: 2,
    borderColor: "#D1D5DB", alignItems: "center", justifyContent: "center",
  },
  dotDone: { backgroundColor: "#059669", borderColor: "#059669" },
  dotActive: { borderColor: "#D97706", backgroundColor: "#FEF3C7" },
  dotCheck: { color: "#fff", fontSize: 12, fontWeight: "700" },
  stepText: { fontSize: 13, color: "#9CA3AF", flex: 1 },
  stepTextDone: { color: "#111827", fontWeight: "500" },
  reasonBox: { backgroundColor: "#FEF2F2", borderColor: "#FECACA", borderWidth: 1, borderRadius: 12, padding: 14 },
  reasonLabel: { fontSize: 13, fontWeight: "700", color: "#B91C1C", marginBottom: 4 },
  reasonText: { fontSize: 13, color: "#DC2626", lineHeight: 19 },
  primaryBtn: { backgroundColor: "#059669", borderRadius: 10, paddingVertical: 14, alignItems: "center" },
  primaryBtnText: { color: "#fff", fontWeight: "600", fontSize: 15 },
  btn: {
    borderWidth: 1, borderColor: "#D1D5DB", borderRadius: 10,
    paddingVertical: 12, alignItems: "center",
  },
  btnText: { color: "#374151", fontWeight: "600" },
  linkBtn: { alignItems: "center", paddingVertical: 4 },
  linkText: { color: "#6B7280", fontWeight: "600" },
  hint: { fontSize: 12, color: "#9CA3AF", textAlign: "center" },
});
