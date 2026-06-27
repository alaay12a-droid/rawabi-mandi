import { useState, useEffect } from "react";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiPost } from "@/constants/api";

export const TOKEN_KEY = "@rawabi_customer_push_token";

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

export async function registerCustomerNotifications(): Promise<string | null> {
  if (Platform.OS === "web") return null;

  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;
    if (existing !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== "granted") return null;

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("order-status", {
        name: "حالة طلبك",
        importance: Notifications.AndroidImportance.HIGH,
        sound: "default",
        vibrationPattern: [0, 200, 100, 200],
        lightColor: "#D4AF37",
        showBadge: true,
      });
    }

    const cached = await AsyncStorage.getItem(TOKEN_KEY);
    if (cached) {
      // Re-register on every app launch so the server always has a fresh entry
      apiPost("/push-tokens", { token: cached, role: "customer" }).catch(() => {});
      return cached;
    }

    const { data } = await Notifications.getExpoPushTokenAsync({ projectId: PROJECT_ID });
    await AsyncStorage.setItem(TOKEN_KEY, data);
    // Register with server so broadcast notifications can reach this device
    apiPost("/push-tokens", { token: data, role: "customer" }).catch(() => {});
    return data;
  } catch {
    return null;
  }
}

export function useCustomerPushToken() {
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(TOKEN_KEY).then((cached) => {
      if (cached) {
        setToken(cached);
      } else {
        registerCustomerNotifications().then(setToken);
      }
    });
  }, []);

  return token;
}
