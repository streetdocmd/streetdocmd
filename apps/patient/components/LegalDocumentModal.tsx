import {
  Modal, View, Text, ScrollView, TouchableOpacity, StyleSheet, Linking, SafeAreaView, Platform,
} from "react-native";
import { legalUrl, type LegalBlock, type LegalDocument } from "@streetdocmd/shared";

// Full-screen sheet rendering a complete StreetdocMD legal document from
// the approved data in @streetdocmd/shared — never retype legal text here.
// Purely informational: opening or closing it never accepts anything.
export default function LegalDocumentModal({
  doc,
  visible,
  onClose,
}: {
  doc: LegalDocument | null;
  visible: boolean;
  onClose: () => void;
}) {
  return (
    <Modal
      visible={visible && !!doc}
      animationType="slide"
      presentationStyle={Platform.OS === "ios" ? "pageSheet" : undefined}
      onRequestClose={onClose}
    >
      {doc && (
        <SafeAreaView style={styles.safe}>
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.brand}>STREETDOCMD</Text>
              <Text style={styles.title} accessibilityRole="header">{doc.title}</Text>
              <Text style={styles.subtitle}>{doc.subtitle}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} accessibilityLabel="Close" hitSlop={8}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
            {doc.partyLine ? <Text style={styles.partyLine}>{doc.partyLine}</Text> : null}
            {doc.intro.length > 0 && (
              <View style={styles.intro}>
                {doc.intro.map((b, i) => <Block key={i} block={b} />)}
              </View>
            )}
            {doc.sections.map(section => (
              <View key={section.id} style={styles.section}>
                <Text style={styles.sectionTitle} accessibilityRole="header">{section.title}</Text>
                {section.blocks.map((b, i) => <Block key={i} block={b} />)}
              </View>
            ))}
          </ScrollView>

          <View style={styles.footer}>
            <View style={{ flex: 1 }}>
              <Text style={styles.version}>{doc.versionLabel}</Text>
              <TouchableOpacity onPress={() => Linking.openURL(legalUrl(doc.slug)).catch(() => {})}>
                <Text style={styles.webLink}>Open on streetdocmd.com ↗</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.doneBtn} onPress={onClose}>
              <Text style={styles.doneText}>Close</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      )}
    </Modal>
  );
}

function Block({ block }: { block: LegalBlock }) {
  switch (block.kind) {
    case "p":
      return <Text style={styles.text}>{block.text}</Text>;
    case "clause":
      return (
        <View style={styles.clause}>
          <Text style={styles.clauseNum}>{block.num}</Text>
          <Text style={[styles.text, styles.clauseText]}>{block.text}</Text>
        </View>
      );
    case "bullets":
      return (
        <View style={styles.bullets}>
          {block.items.map((item, i) => (
            <View key={i} style={styles.bulletRow}>
              <Text style={styles.bulletDot}>•</Text>
              <Text style={[styles.text, styles.clauseText]}>{item}</Text>
            </View>
          ))}
        </View>
      );
    case "table":
      // Phone-width friendly: each row becomes a small card of header: value pairs.
      return (
        <View style={styles.table}>
          {block.rows.map((row, r) => (
            <View key={r} style={[styles.tableRow, r > 0 && styles.tableRowBorder]}>
              {row.map((cell, c) => (
                <View key={c} style={c > 0 ? { marginTop: 4 } : undefined}>
                  {block.headers[c] ? <Text style={styles.tableHeader}>{block.headers[c]}</Text> : null}
                  <Text style={[styles.tableCell, c === 0 && styles.tableCellFirst]}>{cell}</Text>
                </View>
              ))}
            </View>
          ))}
        </View>
      );
    case "callout":
      return (
        <View style={styles.callout}>
          {block.title ? <Text style={styles.calloutTitle}>{block.title}</Text> : null}
          <Text style={styles.calloutText}>{block.text}</Text>
        </View>
      );
  }
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },
  header: {
    backgroundColor: "#0D2B5E", paddingHorizontal: 20, paddingTop: 18, paddingBottom: 16,
    flexDirection: "row", alignItems: "flex-start", gap: 12,
  },
  brand: { fontSize: 11, fontWeight: "700", color: "#BFDBFE", letterSpacing: 0.6 },
  title: { fontSize: 19, fontWeight: "700", color: "#fff", marginTop: 4 },
  subtitle: { fontSize: 12, color: "#BFDBFE", marginTop: 2, lineHeight: 17 },
  closeBtn: {
    width: 34, height: 34, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center", justifyContent: "center",
  },
  closeText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  body: { flex: 1 },
  bodyContent: { padding: 20, paddingBottom: 32 },
  partyLine: { fontSize: 11, fontWeight: "600", color: "#9CA3AF", letterSpacing: 0.3, marginBottom: 14 },
  intro: { borderBottomWidth: 1, borderBottomColor: "#F3F4F6", paddingBottom: 14, marginBottom: 18, gap: 10 },
  section: { marginBottom: 20, gap: 9 },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: "#0D2B5E" },
  text: { fontSize: 14, lineHeight: 21, color: "#4B5563" },
  clause: { flexDirection: "row", gap: 10 },
  clauseNum: { width: 34, fontSize: 13, lineHeight: 21, fontWeight: "600", color: "#9CA3AF" },
  clauseText: { flex: 1 },
  bullets: { gap: 6 },
  bulletRow: { flexDirection: "row", gap: 8, paddingLeft: 4 },
  bulletDot: { fontSize: 14, lineHeight: 21, color: "#9CA3AF" },
  table: { borderWidth: 1, borderColor: "#F3F4F6", borderRadius: 10, overflow: "hidden" },
  tableRow: { padding: 12 },
  tableRowBorder: { borderTopWidth: 1, borderTopColor: "#F3F4F6" },
  tableHeader: { fontSize: 10, fontWeight: "700", color: "#9CA3AF", textTransform: "uppercase", letterSpacing: 0.4 },
  tableCell: { fontSize: 13, lineHeight: 19, color: "#4B5563" },
  tableCellFirst: { color: "#111827", fontWeight: "600" },
  callout: {
    backgroundColor: "#FFFBEB", borderWidth: 1, borderColor: "#FDE68A", borderRadius: 10, padding: 12,
  },
  calloutTitle: { fontSize: 13, fontWeight: "700", color: "#92400E", marginBottom: 3 },
  calloutText: { fontSize: 13, lineHeight: 19, color: "#92400E" },
  footer: {
    flexDirection: "row", alignItems: "center", gap: 12,
    borderTopWidth: 1, borderTopColor: "#F3F4F6", paddingHorizontal: 20, paddingVertical: 12,
  },
  version: { fontSize: 12, color: "#9CA3AF" },
  webLink: { fontSize: 12, color: "#1E6FD9", fontWeight: "600", marginTop: 2 },
  doneBtn: { backgroundColor: "#1E6FD9", borderRadius: 10, paddingHorizontal: 22, paddingVertical: 11 },
  doneText: { color: "#fff", fontWeight: "600", fontSize: 14 },
});
