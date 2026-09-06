import { useState } from "react";
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from "react-native";

const DAYS = Array.from({ length: 14 }, (_, i) => {
  const d = new Date();
  d.setDate(d.getDate() + i);
  d.setHours(0, 0, 0, 0);
  return d;
});

const HOURS = Array.from({ length: 12 }, (_, i) => 8 + i); // 08:00 – 19:00

function formatDayLabel(d: Date, isToday: boolean): string {
  if (isToday) return "Today";
  return d.toLocaleDateString("en-NG", { weekday: "short", day: "numeric", month: "short" });
}

export default function SchedulePicker({
  // scheduledAt is null for ASAP; ready is false only when "Choose a time"
  // is selected but no day/hour has been picked yet.
  onChange,
}: {
  onChange: (scheduledAt: string | null, ready: boolean) => void;
}) {
  const [mode, setMode] = useState<"asap" | "scheduled">("asap");
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [selectedHour, setSelectedHour] = useState<number | null>(null);

  function selectAsap() {
    setMode("asap");
    onChange(null, true);
  }

  function selectScheduled() {
    setMode("scheduled");
    emitIfReady(selectedDay, selectedHour);
  }

  function pickDay(d: Date) {
    setSelectedDay(d);
    emitIfReady(d, selectedHour);
  }

  function pickHour(h: number) {
    setSelectedHour(h);
    emitIfReady(selectedDay, h);
  }

  function emitIfReady(day: Date | null, hour: number | null) {
    if (day && hour != null) {
      const dt = new Date(day);
      dt.setHours(hour, 0, 0, 0);
      onChange(dt.toISOString(), true);
    } else {
      onChange(null, false);
    }
  }

  return (
    <View style={s.card}>
      <Text style={s.title}>When do you need this?</Text>

      <View style={s.toggleRow}>
        <TouchableOpacity
          style={[s.toggleBtn, mode === "asap" && s.toggleBtnActive]}
          onPress={selectAsap}
        >
          <Text style={[s.toggleText, mode === "asap" && s.toggleTextActive]}>As soon as possible</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.toggleBtn, mode === "scheduled" && s.toggleBtnActive]}
          onPress={selectScheduled}
        >
          <Text style={[s.toggleText, mode === "scheduled" && s.toggleTextActive]}>Choose a time</Text>
        </TouchableOpacity>
      </View>

      {mode === "scheduled" && (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12 }}>
            {DAYS.map((d, i) => {
              const isSelected = selectedDay?.getTime() === d.getTime();
              return (
                <TouchableOpacity
                  key={d.toISOString()}
                  style={[s.dayChip, isSelected && s.dayChipActive]}
                  onPress={() => pickDay(d)}
                >
                  <Text style={[s.dayChipText, isSelected && s.dayChipTextActive]}>
                    {formatDayLabel(d, i === 0)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <View style={s.hourGrid}>
            {HOURS.map(h => {
              const isSelected = selectedHour === h;
              return (
                <TouchableOpacity
                  key={h}
                  style={[s.hourChip, isSelected && s.hourChipActive]}
                  onPress={() => pickHour(h)}
                >
                  <Text style={[s.hourChipText, isSelected && s.hourChipTextActive]}>
                    {h.toString().padStart(2, "0")}:00
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: "#fff", borderRadius: 12, padding: 16,
    borderWidth: 1, borderColor: "#E5E7EB",
  },
  title: { fontSize: 14, fontWeight: "600", color: "#111827", marginBottom: 10 },
  toggleRow: { flexDirection: "row", gap: 8 },
  toggleBtn: {
    flex: 1, borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 10,
    paddingVertical: 10, alignItems: "center",
  },
  toggleBtnActive: { borderColor: "#1E6FD9", backgroundColor: "#EFF6FF" },
  toggleText: { fontSize: 13, fontWeight: "500", color: "#6B7280" },
  toggleTextActive: { color: "#1E6FD9" },
  dayChip: {
    borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 8, marginRight: 8,
  },
  dayChipActive: { borderColor: "#1E6FD9", backgroundColor: "#1E6FD9" },
  dayChipText: { fontSize: 13, color: "#374151", fontWeight: "500" },
  dayChipTextActive: { color: "#fff" },
  hourGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  hourChip: {
    borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  hourChipActive: { borderColor: "#1E6FD9", backgroundColor: "#1E6FD9" },
  hourChipText: { fontSize: 13, color: "#374151", fontWeight: "500" },
  hourChipTextActive: { color: "#fff" },
});
