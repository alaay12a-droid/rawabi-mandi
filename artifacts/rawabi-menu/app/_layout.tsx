import {
  Cairo_400Regular,
  Cairo_600SemiBold,
  Cairo_700Bold,
  Cairo_800ExtraBold,
  useFonts,
} from "@expo-google-fonts/cairo";
import { Feather } from "@expo/vector-icons";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter, useSegments } from "expo-router";
import * as Notifications from "expo-notifications";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useRef } from "react";
import { Platform } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { CartProvider } from "@/context/CartContext";
import { DetailSheetProvider } from "@/context/DetailSheetContext";
import { UserProvider, useUser } from "@/context/UserContext";
import { OrderBadgeProvider } from "@/context/OrderBadgeContext";
import { LanguageProvider } from "@/context/LanguageContext";
import { AppConfigProvider } from "@/context/AppConfigContext";
import { FavoritesProvider } from "@/context/FavoritesContext";
import { MusicProvider } from "@/context/MusicContext";
import { registerCustomerNotifications } from "@/hooks/useCustomerPushToken";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

if (Platform.OS === "web" && typeof document !== "undefined") {
  document.documentElement.lang = "ar";
  document.documentElement.setAttribute("translate", "no");

  const meta = document.createElement("meta");
  meta.setAttribute("name", "google");
  meta.setAttribute("content", "notranslate");
  document.head.appendChild(meta);

  const metaTranslate = document.createElement("meta");
  metaTranslate.setAttribute("http-equiv", "Content-Language");
  metaTranslate.setAttribute("content", "ar");
  document.head.appendChild(metaTranslate);

  const style = document.createElement("style");
  style.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap');
    html, body { direction: rtl; font-family: 'Cairo', sans-serif; }
    *:not(.emoji) { font-family: 'Cairo', sans-serif; }
    span.emoji { font-family: 'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif !important; }
  `;
  document.head.appendChild(style);
}

function AuthGate() {
  const { user, isLoading } = useUser();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (isLoading) return;
    const onOnboarding = segments[0] === "onboarding";
    if (!user && !onOnboarding) {
      router.replace("/onboarding");
    } else if (user && onOnboarding) {
      router.replace("/(tabs)/home");
    }
  }, [user, isLoading, segments]);

  return null;
}

function NotificationSetup() {
  const router = useRouter();
  const responseListener = useRef<Notifications.EventSubscription | null>(null);

  useEffect(() => {
    // Request notification permissions immediately on app launch
    registerCustomerNotifications().catch(() => {});

    // Navigate to order-confirmed screen when customer taps a status notification
    try {
      responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
        const data = response.notification.request.content.data as Record<string, unknown>;
        const orderId = data?.orderId;
        if (orderId != null) {
          router.push(`/order-confirmed?orderId=${orderId}`);
        }
      });
    } catch {
      // Not supported in this environment — safe to ignore
    }

    return () => {
      try {
        responseListener.current?.remove();
      } catch {}
    };
  }, []);

  return null;
}

function RootLayoutNav() {
  return (
    <>
      <NotificationSetup />
      <AuthGate />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="onboarding" options={{ headerShown: false, animation: "fade" }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="cart" options={{ headerShown: false, presentation: "modal" }} />
        <Stack.Screen name="checkout" options={{ headerShown: false }} />
        <Stack.Screen name="order-confirmed" options={{ headerShown: false }} />
        <Stack.Screen name="cashier" options={{ headerShown: false }} />
        <Stack.Screen name="admin-menu" options={{ headerShown: false }} />
        <Stack.Screen name="terms" options={{ headerShown: false }} />
        <Stack.Screen name="wallet" options={{ headerShown: false }} />
        <Stack.Screen name="app-settings" options={{ headerShown: false }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Cairo_400Regular,
    Cairo_600SemiBold,
    Cairo_700Bold,
    Cairo_800ExtraBold,
    ...Feather.font,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <LanguageProvider>
            <AppConfigProvider>
              <UserProvider>
                <FavoritesProvider>
                <CartProvider>
                  <DetailSheetProvider>
                  <OrderBadgeProvider>
                    <MusicProvider>
                    <GestureHandlerRootView>
                      <KeyboardProvider>
                        <RootLayoutNav />
                      </KeyboardProvider>
                    </GestureHandlerRootView>
                    </MusicProvider>
                  </OrderBadgeProvider>
                  </DetailSheetProvider>
                </CartProvider>
                </FavoritesProvider>
              </UserProvider>
            </AppConfigProvider>
          </LanguageProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
