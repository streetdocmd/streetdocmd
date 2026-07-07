import { Tabs } from "expo-router";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: "#1E6FD9",
        tabBarInactiveTintColor: "#9CA3AF",
        tabBarStyle: { borderTopWidth: 1, borderTopColor: "#F3F4F6" },
        headerStyle: { backgroundColor: "#0D2B5E" },
        headerTintColor: "#fff",
        headerTitleStyle: { fontWeight: "bold" },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{ title: "Home", tabBarIcon: ({ color }) => <TabIcon emoji="🏠" color={color} /> }}
      />
      <Tabs.Screen
        name="bookings"
        options={{ title: "My Bookings", tabBarIcon: ({ color }) => <TabIcon emoji="📋" color={color} /> }}
      />
      <Tabs.Screen
        name="records"
        options={{ title: "Records", tabBarIcon: ({ color }) => <TabIcon emoji="📁" color={color} /> }}
      />
      <Tabs.Screen
        name="investigations"
        options={{ title: "Lab Tests", tabBarIcon: ({ color }) => <TabIcon emoji="🧪" color={color} /> }}
      />
      <Tabs.Screen
        name="medications"
        options={{ title: "Medications", tabBarIcon: ({ color }) => <TabIcon emoji="💊" color={color} /> }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: "Profile", tabBarIcon: ({ color }) => <TabIcon emoji="👤" color={color} /> }}
      />
    </Tabs>
  );
}

function TabIcon({ emoji, color }: { emoji: string; color: string }) {
  const { Text } = require("react-native");
  return <Text style={{ fontSize: 20, opacity: color === "#1E6FD9" ? 1 : 0.5 }}>{emoji}</Text>;
}
