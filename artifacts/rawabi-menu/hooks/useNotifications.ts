import { useEffect, useRef } from "react";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { apiPost } from "@/constants/api";

const PROJECT_ID = "75492716-d1d5-4871-bfd9-18c7ef3982c7";

// Must be wrapped in try/catch — throws in Expo Go and some emulators
try {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
} catch {
  // Not supported in this environment — safe to ignore
}

async function registerForPushNotifications(): Promise<string | null> {
  if (Platform.OS === "web") return null;

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") return null;

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("orders", {
        name: "طلبات جديدة",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 300, 200, 300],
        lightColor: "#D4AF37",
        sound: "notification_loop",
        enableVibrate: true,
        showBadge: true,
      });
    }

    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId: PROJECT_ID });
    return tokenData.data;
  } catch {
    return null;
  }
}

export function useNotifications() {
  const notificationListener = useRef<Notifications.EventSubscription | null>(null);
  const responseListener = useRef<Notifications.EventSubscription | null>(null);

  useEffect(() => {
    registerForPushNotifications().then(async (token) => {
      if (!token) return;
      try {
        await apiPost("/push-tokens", { token });
      } catch {}
    });

    try {
      notificationListener.current = Notifications.addNotificationReceivedListener(() => {});
      responseListener.current = Notifications.addNotificationResponseReceivedListener(() => {});
    } catch {}

    return () => {
      try {
        notificationListener.current?.remove();
        responseListener.current?.remove();
      } catch {}
    };
  }, []);
}
