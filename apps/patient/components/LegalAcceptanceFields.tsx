import { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { PATIENT_TERMS, PRIVACY_POLICY, type LegalDocument } from "@streetdocmd/shared";
import { TERMS_ACCEPTANCE_LABEL, PRIVACY_ACKNOWLEDGEMENT_LABEL } from "../lib/legal";
import LegalDocumentModal from "./LegalDocumentModal";

export type LegalAcceptanceValue = { terms: boolean; privacy: boolean };

// The two separate, unchecked-by-default controls the Patient Terms (cl. 1.1,
// 20) and Privacy Policy (s.7) require — exact wording from the documents,
// each with its own "Read" link to the full text. The parent owns the
// values and must start them both at false.
export default function LegalAcceptanceFields({
  value,
  onChange,
  showErrors = false,
}: {
  value: LegalAcceptanceValue;
  onChange: (next: LegalAcceptanceValue) => void;
  showErrors?: boolean;
}) {
  const [openDoc, setOpenDoc] = useState<LegalDocument | null>(null);

  return (
    <View style={styles.wrap}>
      <Row
        checked={value.terms}
        onToggle={() => onChange({ ...value, terms: !value.terms })}
        label={TERMS_ACCEPTANCE_LABEL}
        onRead={() => setOpenDoc(PATIENT_TERMS)}
        readLabel="Read the Terms of Service"
        error={showErrors && !value.terms ? "Please agree to the Terms of Service to continue." : undefined}
      />
      <Row
        checked={value.privacy}
        onToggle={() => onChange({ ...value, privacy: !value.privacy })}
        label={PRIVACY_ACKNOWLEDGEMENT_LABEL}
        onRead={() => setOpenDoc(PRIVACY_POLICY)}
        readLabel="Read the Privacy Policy"
        error={showErrors && !value.privacy ? "Please acknowledge the Privacy Policy to continue." : undefined}
      />
      <LegalDocumentModal doc={openDoc} visible={!!openDoc} onClose={() => setOpenDoc(null)} />
    </View>
  );
}

function Row({
  checked, onToggle, label, onRead, readLabel, error,
}: {
  checked: boolean;
  onToggle: () => void;
  label: string;
  onRead: () => void;
  readLabel: string;
  error?: string;
}) {
  return (
    <View>
      <View style={[styles.row, checked && styles.rowChecked, !!error && styles.rowError]}>
        <TouchableOpacity
          style={styles.toggle}
          onPress={onToggle}
          activeOpacity={0.7}
          accessibilityRole="checkbox"
          accessibilityState={{ checked }}
          accessibilityLabel={label}
        >
          <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
            {checked && <Text style={styles.checkmark}>✓</Text>}
          </View>
          <Text style={styles.label}>{label}</Text>
        </TouchableOpacity>
        <View style={styles.metaRow}>
          <TouchableOpacity onPress={onRead} accessibilityRole="link" accessibilityLabel={readLabel} hitSlop={8}>
            <Text style={styles.read}>Read →</Text>
          </TouchableOpacity>
          <Text style={styles.required}>REQUIRED</Text>
        </View>
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10, marginBottom: 20 },
  row: { borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 12, padding: 12, backgroundColor: "#fff" },
  rowChecked: { borderColor: "#BFDBFE", backgroundColor: "#EFF6FF" },
  rowError: { borderColor: "#FECACA", backgroundColor: "#FEF2F2" },
  toggle: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  checkbox: {
    width: 22, height: 22, borderRadius: 5, borderWidth: 2,
    borderColor: "#D1D5DB", alignItems: "center", justifyContent: "center",
    marginTop: 1, flexShrink: 0, backgroundColor: "#fff",
  },
  checkboxChecked: { backgroundColor: "#1E6FD9", borderColor: "#1E6FD9" },
  checkmark: { color: "#fff", fontSize: 13, fontWeight: "700" },
  label: { flex: 1, fontSize: 13, color: "#111827", lineHeight: 19 },
  metaRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8, paddingLeft: 34 },
  read: { fontSize: 13, color: "#1E6FD9", fontWeight: "600" },
  required: { fontSize: 10, color: "#9CA3AF", fontWeight: "700", letterSpacing: 0.5 },
  error: { color: "#DC2626", fontSize: 12, marginTop: 4, marginLeft: 4 },
});
