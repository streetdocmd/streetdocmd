import { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, KeyboardAvoidingView, Platform, ScrollView
} from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "../../lib/supabase";
import {
  SPECIALTIES, getPractitionerType,
  PROVIDER_AGREEMENT_ACCEPTANCE_LABEL, PROVIDER_AGREEMENT_TITLE, PROVIDER_AGREEMENT_VERSION,
} from "@streetdocmd/shared";
import ProviderAgreementModal from "../../components/ProviderAgreementModal";
import { PROVIDER_PORTAL_URL } from "../../lib/config";

export default function ProviderRegisterScreen() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [specialistField, setSpecialistField] = useState("");
  const [credentials, setCredentials] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [yearsExp, setYearsExp] = useState("");
  const [ndpr, setNdpr] = useState(false);
  // Clause 3.2 / 21: must be ticked by the provider — never preselected
  const [agreed, setAgreed] = useState(false);
  const [showAgreement, setShowAgreement] = useState(false);
  const [loading, setLoading] = useState(false);

  const practitionerType = getPractitionerType(specialty);

  async function register() {
    if (loading) return;
    if (!ndpr) {
      Alert.alert("Consent required", "Please accept the data privacy notice.");
      return;
    }
    if (!agreed) {
      Alert.alert("Agreement required", `Please accept the ${PROVIDER_AGREEMENT_TITLE} to continue.`);
      return;
    }
    if (practitionerType && !licenseNumber.trim()) {
      Alert.alert("Missing licence number", `Please enter your ${practitionerType.licenseLabel}.`);
      return;
    }
    if (practitionerType?.requiresSpecialistField && !specialistField.trim()) {
      Alert.alert("Missing specialist field", "Please enter your specialist field.");
      return;
    }
    if (phone.replace(/\D/g, "").length < 10) {
      Alert.alert("Check your phone number", "Please enter a valid phone number, e.g. 08012345678.");
      return;
    }
    setLoading(true);

    // Registration runs server-side (provider-web /api/register, service role):
    // it creates the auth user, the users row and the providers row together,
    // records NDPR consent and the agreement acceptance with a server
    // timestamp, and works whether or not Supabase "Confirm email" is on.
    // A client-side signUp + insert could leave a login with no profile.
    let json: { ok?: boolean; error?: string } = {};
    try {
      const res = await fetch(`${PROVIDER_PORTAL_URL}/api/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim(),
          password,
          specialty,
          specialist_field: specialistField.trim(),
          credentials: credentials.trim(),
          license_number: licenseNumber.trim(),
          years_experience: yearsExp,
          ndpr_consent: true,
          agreement_accepted: true,
          agreement_version: PROVIDER_AGREEMENT_VERSION,
        }),
      });
      json = await res.json().catch(() => ({}));
      if (!res.ok) {
        Alert.alert("Couldn't create your account", json.error ?? "Please try again.");
        setLoading(false);
        return;
      }
    } catch {
      Alert.alert("Connection problem", "Please check your internet connection and try again.");
      setLoading(false);
      return;
    }

    const { error: signInErr } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (signInErr) {
      Alert.alert("Account created", "Your application was saved. Please sign in to continue.");
      router.replace("/(auth)/login");
      return;
    }
    router.replace("/(auth)/pending");
  }

  const ready = name && email && phone && password.length >= 8 && specialty && credentials && ndpr && agreed;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.logo}>StreetdocMD</Text>
          <Text style={styles.tagline}>Join as a healthcare provider</Text>

          <Text style={styles.label}>Full name</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName}
            placeholder="Dr. Amara Nwosu" autoCapitalize="words" />

          <Text style={styles.label}>Email address</Text>
          <TextInput style={styles.input} value={email} onChangeText={setEmail}
            placeholder="you@example.com" keyboardType="email-address"
            autoCapitalize="none" autoCorrect={false} />

          <Text style={styles.label}>Phone number</Text>
          <TextInput style={styles.input} value={phone} onChangeText={setPhone}
            placeholder="08012345678" keyboardType="phone-pad" />

          <Text style={styles.label}>Password</Text>
          <TextInput style={styles.input} value={password} onChangeText={setPassword}
            placeholder="At least 8 characters" secureTextEntry autoCapitalize="none" />

          <Text style={styles.label}>Specialty</Text>
          <View style={styles.specialtyGrid}>
            {SPECIALTIES.map(s => (
              <TouchableOpacity
                key={s}
                style={[styles.specialtyChip, specialty === s && styles.specialtyChipActive]}
                onPress={() => setSpecialty(s)}
              >
                <Text style={[styles.specialtyText, specialty === s && styles.specialtyTextActive]}>
                  {s}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {practitionerType?.requiresSpecialistField && (
            <>
              <Text style={styles.label}>Specialist field</Text>
              <TextInput style={styles.input} value={specialistField} onChangeText={setSpecialistField}
                placeholder="e.g. Cardiology, Paediatrics" />
            </>
          )}

          <Text style={styles.label}>Credentials (e.g. MBBS, RN, BNSc)</Text>
          <TextInput style={styles.input} value={credentials} onChangeText={setCredentials}
            placeholder="MBBS" autoCapitalize="characters" />

          {practitionerType && (
            <>
              <Text style={styles.label}>{practitionerType.licenseLabel}</Text>
              <TextInput style={styles.input} value={licenseNumber} onChangeText={setLicenseNumber}
                placeholder={`e.g. ${practitionerType.licenseBody}/12345`} />
            </>
          )}

          <Text style={styles.label}>Years of experience</Text>
          <TextInput style={styles.input} value={yearsExp} onChangeText={setYearsExp}
            placeholder="5" keyboardType="number-pad" />

          <TouchableOpacity style={styles.consentRow} onPress={() => setNdpr(v => !v)} activeOpacity={0.7}>
            <View style={[styles.checkbox, ndpr && styles.checkboxChecked]}>
              {ndpr && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <Text style={styles.consentText}>
              I consent to StreetdocMD processing my professional and health data under the
              Nigeria Data Protection Regulation (NDPR).
            </Text>
          </TouchableOpacity>

          <View style={styles.agreementBox}>
            <TouchableOpacity style={styles.consentRow} onPress={() => setAgreed(v => !v)} activeOpacity={0.7}>
              <View style={[styles.checkbox, agreed && styles.checkboxChecked]}>
                {agreed && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <Text style={styles.consentText}>{PROVIDER_AGREEMENT_ACCEPTANCE_LABEL}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowAgreement(true)} style={styles.readLink}>
              <Text style={styles.readLinkText}>Read the {PROVIDER_AGREEMENT_TITLE}</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.btn, (!ready || loading) && styles.btnDisabled]}
            onPress={register}
            disabled={!ready || loading}
          >
            <Text style={styles.btnText}>{loading ? "Submitting..." : "Submit Application"}</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.back()} style={styles.back}>
            <Text style={styles.backText}>Already have an account? Sign in</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
      <ProviderAgreementModal visible={showAgreement} onClose={() => setShowAgreement(false)} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#064E3B" },
  scroll: { padding: 20, paddingVertical: 40 },
  card: { backgroundColor: "#fff", borderRadius: 16, padding: 28 },
  logo: { fontSize: 26, fontWeight: "bold", color: "#064E3B", textAlign: "center" },
  tagline: { fontSize: 13, color: "#888", textAlign: "center", marginBottom: 24 },
  label: { fontSize: 14, color: "#444", marginBottom: 6, fontWeight: "500" },
  input: {
    borderWidth: 1, borderColor: "#ddd", borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, marginBottom: 16,
  },
  specialtyGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  specialtyChip: {
    borderWidth: 1, borderColor: "#D1D5DB", borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 7,
  },
  specialtyChipActive: { backgroundColor: "#059669", borderColor: "#059669" },
  specialtyText: { fontSize: 13, color: "#374151" },
  specialtyTextActive: { color: "#fff", fontWeight: "600" },
  consentRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 20 },
  checkbox: {
    width: 22, height: 22, borderRadius: 5, borderWidth: 2,
    borderColor: "#D1D5DB", alignItems: "center", justifyContent: "center",
    marginTop: 1, flexShrink: 0,
  },
  checkboxChecked: { backgroundColor: "#059669", borderColor: "#059669" },
  checkmark: { color: "#fff", fontSize: 13, fontWeight: "700" },
  consentText: { flex: 1, fontSize: 12, color: "#6B7280", lineHeight: 18 },
  agreementBox: {
    borderWidth: 1, borderColor: "#A7F3D0", backgroundColor: "#ECFDF5",
    borderRadius: 12, padding: 14, paddingBottom: 10, marginBottom: 20,
  },
  readLink: { marginTop: -8, marginLeft: 34, paddingVertical: 4 },
  readLinkText: { fontSize: 13, fontWeight: "600", color: "#059669", textDecorationLine: "underline" },
  btn: { backgroundColor: "#059669", borderRadius: 10, paddingVertical: 14, alignItems: "center" },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: "#fff", fontWeight: "600", fontSize: 15 },
  back: { marginTop: 18, alignItems: "center" },
  backText: { fontSize: 14, color: "#6B7280" },
});