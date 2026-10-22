import { useCallback, useEffect, useState } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, FlatList, Image, TextInput, RefreshControl,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { supabase } from "../../lib/supabase";
import { ServiceType, SERVICE_LABELS, SERVICE_PRICES, SERVICE_PROFESSION, formatNaira } from "@streetdocmd/shared";

export interface ProviderOption {
  id: string;
  name: string;
  photo_url: string | null;
  specialty: string;
  rating: number;
  total_visits: number;
  years_experience: number;
  available: boolean;
  price: number;
}

// Providers set their own prices (provider_services.service_type → price); anyone who
// hasn't priced this service is charged the standard rate. The booking server applies
// the same rule, so the price shown here is what the patient pays.
async function loadProviders(service: ServiceType): Promise<ProviderOption[]> {
  const { data: providers, error } = await supabase
    .from("providers")
    .select("id, name, photo_url, specialty, specialist_field, rating, total_visits, years_experience, available")
    .eq("verification_status", "verified")
    .eq("profession", SERVICE_PROFESSION[service])
    .limit(100);
  if (error) throw error;
  if (!providers?.length) return [];

  const { data: prices } = await supabase
    .from("provider_services")
    .select("provider_id, price")
    .eq("service_type", service)
    .eq("active", true)
    .in("provider_id", providers.map(p => p.id));
  const priceOf = new Map((prices ?? []).map(p => [p.provider_id as string, Number(p.price)]));

  return providers
    .map(p => ({
      id: p.id,
      name: p.name,
      photo_url: p.photo_url ?? null,
      specialty: [p.specialty, p.specialist_field].filter(Boolean).join(" · "),
      rating: Number(p.rating) || 0,
      total_visits: Number(p.total_visits) || 0,
      years_experience: Number(p.years_experience) || 0,
      available: !!p.available,
      price: priceOf.get(p.id) ?? SERVICE_PRICES[service],
    }))
    // Online now first, then best rated, then most experienced
    .sort((a, b) => Number(b.available) - Number(a.available) || b.rating - a.rating || b.total_visits - a.total_visits);
}

export default function ChooseProviderScreen() {
  const { service, description } = useLocalSearchParams<{ service: ServiceType; description?: string }>();
  const router = useRouter();
  const [providers, setProviders] = useState<ProviderOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      setProviders(await loadProviders(service));
    } catch {
      setError("Couldn't load providers. Pull down to try again.");
    }
  }, [service]);

  useEffect(() => { load().finally(() => setLoading(false)); }, [load]);

  function choose(p: ProviderOption | null) {
    router.push({
      pathname: "/booking/confirm",
      params: {
        service,
        ...(description ? { description } : {}),
        ...(p ? { providerId: p.id, providerName: p.name, price: String(p.price) } : {}),
      },
    });
  }

  const q = query.trim().toLowerCase();
  const shown = q ? providers.filter(p => `${p.name} ${p.specialty}`.toLowerCase().includes(q)) : providers;
  const label = SERVICE_LABELS[service] ?? "Book care";

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.title}>{label}</Text>
        <Text style={s.subtitle}>Choose a provider. Each sets their own price.</Text>
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator size="large" color="#1E6FD9" /></View>
      ) : (
        <FlatList
          data={shown}
          keyExtractor={p => p.id}
          contentContainerStyle={s.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
          ListHeaderComponent={
            <>
              {!!description && <Text style={s.description}>&ldquo;{description}&rdquo;</Text>}
              {!!error && <Text style={s.error}>{error}</Text>}
              {providers.length > 6 && (
                <TextInput
                  style={s.search}
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Search by name or specialty"
                  placeholderTextColor="#9CA3AF"
                />
              )}
              {!error && providers.length === 0 && (
                <View style={s.empty}>
                  <Text style={s.emptyTitle}>No providers are listed for {label} yet</Text>
                  <Text style={s.emptyText}>We can still send you the nearest available verified provider.</Text>
                </View>
              )}
              {providers.length > 0 && shown.length === 0 && (
                <Text style={s.emptyText}>No providers match &ldquo;{query}&rdquo;.</Text>
              )}
            </>
          }
          renderItem={({ item: p }) => (
            <TouchableOpacity style={s.card} onPress={() => choose(p)} activeOpacity={0.8}>
              {p.photo_url ? (
                <Image source={{ uri: p.photo_url }} style={s.avatar} />
              ) : (
                <View style={[s.avatar, s.avatarFallback]}>
                  <Text style={s.avatarText}>{p.name.replace(/^(dr|nurse|mr|mrs|ms)\.?\s+/i, "").charAt(0).toUpperCase()}</Text>
                </View>
              )}
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={s.row}>
                  <Text style={s.name} numberOfLines={1}>{p.name} <Text style={s.verified}>✓</Text></Text>
                  <Text style={s.price}>{formatNaira(p.price)}</Text>
                </View>
                {!!p.specialty && <Text style={s.specialty} numberOfLines={1}>{p.specialty}</Text>}
                <View style={s.meta}>
                  <Text style={s.metaText}>
                    {p.rating > 0 ? `★ ${p.rating.toFixed(1)} · ${p.total_visits} visit${p.total_visits === 1 ? "" : "s"}` : "New provider"}
                  </Text>
                  {p.years_experience > 0 && <Text style={s.metaText}>{p.years_experience} yrs experience</Text>}
                  {p.available && <Text style={s.available}>● Available now</Text>}
                </View>
              </View>
            </TouchableOpacity>
          )}
          ListFooterComponent={
            <TouchableOpacity
              style={providers.length === 0 ? s.primaryBtn : s.nearestCard}
              onPress={() => choose(null)}
              activeOpacity={0.8}
            >
              {providers.length === 0 ? (
                <Text style={s.primaryBtnText}>Send me the nearest available provider</Text>
              ) : (
                <>
                  <Text style={s.nearestTitle}>No preference? Send the nearest available provider</Text>
                  <Text style={s.nearestText}>The fastest option. You&apos;ll see the price before you pay.</Text>
                </>
              )}
            </TouchableOpacity>
          }
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },
  header: { backgroundColor: "#0D2B5E", padding: 20 },
  title: { fontSize: 18, fontWeight: "bold", color: "#fff" },
  subtitle: { fontSize: 13, color: "#BFDBFE", marginTop: 4 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  list: { padding: 16, gap: 12, paddingBottom: 32 },
  description: { fontSize: 13, color: "#6B7280", fontStyle: "italic", marginBottom: 12 },
  error: { fontSize: 13, color: "#B91C1C", backgroundColor: "#FEF2F2", borderRadius: 10, padding: 12, marginBottom: 12 },
  search: {
    backgroundColor: "#fff", borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 11, fontSize: 15, marginBottom: 12, color: "#111827",
  },
  empty: { backgroundColor: "#fff", borderRadius: 12, borderWidth: 1, borderColor: "#E5E7EB", padding: 20, alignItems: "center", marginBottom: 12 },
  emptyTitle: { fontSize: 15, fontWeight: "600", color: "#111827", textAlign: "center" },
  emptyText: { fontSize: 13, color: "#6B7280", textAlign: "center", marginTop: 4 },
  card: {
    backgroundColor: "#fff", borderRadius: 12, borderWidth: 1, borderColor: "#E5E7EB",
    padding: 14, flexDirection: "row", gap: 12, alignItems: "flex-start",
  },
  avatar: { width: 52, height: 52, borderRadius: 26 },
  avatarFallback: { backgroundColor: "#EFF6FF", alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 20, fontWeight: "700", color: "#1E6FD9" },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 8 },
  name: { flexShrink: 1, fontSize: 15, fontWeight: "600", color: "#111827" },
  verified: { color: "#1E6FD9", fontSize: 13 },
  price: { fontSize: 16, fontWeight: "700", color: "#1E6FD9" },
  specialty: { fontSize: 13, color: "#6B7280", marginTop: 1 },
  meta: { flexDirection: "row", flexWrap: "wrap", columnGap: 10, rowGap: 2, marginTop: 6 },
  metaText: { fontSize: 12, color: "#6B7280" },
  available: { fontSize: 12, fontWeight: "600", color: "#15803D" },
  nearestCard: {
    backgroundColor: "#fff", borderRadius: 12, borderWidth: 1, borderColor: "#BFDBFE",
    borderStyle: "dashed", padding: 16, marginTop: 4,
  },
  nearestTitle: { fontSize: 14, fontWeight: "600", color: "#111827" },
  nearestText: { fontSize: 12, color: "#6B7280", marginTop: 2 },
  primaryBtn: { backgroundColor: "#1E6FD9", borderRadius: 12, paddingVertical: 16, alignItems: "center", marginTop: 4 },
  primaryBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
});
