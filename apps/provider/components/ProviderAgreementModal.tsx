import { Modal, View, Text, ScrollView, TouchableOpacity, StyleSheet } from "react-native";
import {
  PROVIDER_AGREEMENT_INTRO,
  PROVIDER_AGREEMENT_PARTY_LINE,
  PROVIDER_AGREEMENT_SCHEDULE_1,
  PROVIDER_AGREEMENT_SCHEDULE_2,
  PROVIDER_AGREEMENT_SECTIONS,
  PROVIDER_AGREEMENT_SUBTITLE,
  PROVIDER_AGREEMENT_TITLE,
  PROVIDER_AGREEMENT_VERSION,
  PROVIDER_AGREEMENT_YEAR,
} from "@streetdocmd/shared";

// Full text of the Provider Service Agreement. Reading only — closing it never grants
// acceptance; the unchecked checkbox on the registration screen does.
export default function ProviderAgreementModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} presentationStyle="pageSheet">
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.brand}>StreetdocMD</Text>
            <Text style={styles.title}>{PROVIDER_AGREEMENT_TITLE}</Text>
            <Text style={styles.subtitle}>{PROVIDER_AGREEMENT_SUBTITLE}</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.close} accessibilityLabel="Close">
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.body}>
          <Text style={styles.partyLine}>{PROVIDER_AGREEMENT_PARTY_LINE}</Text>
          <View style={styles.intro}>
            <Text style={styles.introLabel}>ONLINE AGREEMENT</Text>
            <Text style={styles.text}>{PROVIDER_AGREEMENT_INTRO}</Text>
          </View>

          {PROVIDER_AGREEMENT_SECTIONS.map(section => (
            <View key={section.num} style={styles.section}>
              <Text style={styles.sectionTitle}>{section.num}. {section.title}</Text>
              {section.clauses.map(([n, text]) => <Clause key={n} n={n} text={text} />)}
              {section.bullets?.map(b => (
                <Text key={b} style={[styles.text, styles.bullet]}>•  {b}</Text>
              ))}
              {section.after?.map(([n, text]) => <Clause key={n} n={n} text={text} />)}
            </View>
          ))}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Schedule 1. Provider Commercial Framework</Text>
            {PROVIDER_AGREEMENT_SCHEDULE_1.map(([item, framework]) => (
              <View key={item} style={styles.row}>
                <Text style={styles.rowItem}>{item}</Text>
                <Text style={styles.text}>{framework}</Text>
              </View>
            ))}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Schedule 2. Professional and Operational Particulars</Text>
            <Text style={styles.text}>{PROVIDER_AGREEMENT_SCHEDULE_2}</Text>
          </View>

          <Text style={styles.version}>Version {PROVIDER_AGREEMENT_VERSION} · {PROVIDER_AGREEMENT_YEAR}</Text>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity style={styles.btn} onPress={onClose}>
            <Text style={styles.btnText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function Clause({ n, text }: { n: string; text: string }) {
  return (
    <Text style={[styles.text, styles.clause]}>
      <Text style={styles.clauseNum}>{n} </Text>
      {text}
    </Text>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  header: { flexDirection: "row", alignItems: "flex-start", backgroundColor: "#064E3B", padding: 20, paddingTop: 24 },
  brand: { fontSize: 18, fontWeight: "bold", color: "#fff" },
  title: { fontSize: 14, fontWeight: "600", color: "#fff", marginTop: 4 },
  subtitle: { fontSize: 12, color: "#A7F3D0", marginTop: 2 },
  close: { width: 32, height: 32, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.12)", alignItems: "center", justifyContent: "center" },
  closeText: { color: "#fff", fontSize: 14 },
  body: { padding: 20, paddingBottom: 32 },
  partyLine: { fontSize: 10, fontWeight: "600", color: "#9CA3AF", marginBottom: 8, letterSpacing: 0.3 },
  intro: { backgroundColor: "#F3F4F6", borderRadius: 10, padding: 14, marginBottom: 20 },
  introLabel: { fontSize: 10, fontWeight: "700", color: "#6B7280", marginBottom: 4, letterSpacing: 0.5 },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 14, fontWeight: "700", color: "#064E3B", marginBottom: 8 },
  text: { fontSize: 13, lineHeight: 19, color: "#4B5563" },
  clause: { marginBottom: 6 },
  clauseNum: { fontWeight: "700", color: "#374151" },
  bullet: { marginBottom: 4, paddingLeft: 4 },
  row: { borderTopWidth: 1, borderTopColor: "#F3F4F6", paddingVertical: 8 },
  rowItem: { fontSize: 13, fontWeight: "600", color: "#374151", marginBottom: 2 },
  version: { fontSize: 11, color: "#9CA3AF", textAlign: "center", marginTop: 4 },
  footer: { borderTopWidth: 1, borderTopColor: "#F3F4F6", padding: 16 },
  btn: { backgroundColor: "#059669", borderRadius: 10, paddingVertical: 14, alignItems: "center" },
  btnText: { color: "#fff", fontWeight: "600", fontSize: 15 },
});
