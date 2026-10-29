// Registers this device for push notifications (push_subscriptions,
// migration 065). The send-notification Edge Function sends to every token
// saved here. Needs an EAS project id (run `eas init`); without one Expo
// can't issue a token, so this quietly does nothing.
import { Platform } from "react-native";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { supabase } from "./supabase";

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowAlert: true, shouldPlaySound: true, shouldSetBadge: true }),
});

export async function registerForPush(userId: string) {
  try {
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "StreetdocMD",
        importance: Notifications.AndroidImportance.HIGH,
      });
    }

    const projectId = (Constants.expoConfig?.extra as any)?.eas?.projectId ?? (Constants as any).easConfig?.projectId;
    if (!projectId) return;

    let { status } = await Notifications.getPermissionsAsync();
    if (status !== "granted") ({ status } = await Notifications.requestPermissionsAsync());
    if (status !== "granted") return;

    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    await supabase.from("push_subscriptions").upsert(
      { user_id: userId, kind: "expo", token, user_agent: `${Platform.OS} app` },
      { onConflict: "token" },
    );
  } catch {
    // Simulators and devices without Play Services can't get a token
  }
}
