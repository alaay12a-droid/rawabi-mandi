import React, { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { LoginScreen } from '@/components/LoginScreen';
import { ActivityIndicator, I18nManager, StyleSheet, View } from 'react-native';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, useFonts } from '@expo-google-fonts/inter';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColors } from '../hooks/useColors';
import { AuthProvider, useAuth } from '../lib/AuthContext';
import { TerminalProvider } from '../lib/TerminalContext';

void SplashScreen.preventAutoHideAsync().catch((error) => {
  console.warn('Unable to keep the splash screen visible:', error);
});

try {
  I18nManager.allowRTL(true);
  I18nManager.forceRTL(true);
} catch (e) {}

const queryClient = new QueryClient();

function AuthGate() {
  const colors = useColors();
  const auth = useAuth();
  const loading = auth.loading;
  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }
  if (!auth.user) return <LoginScreen />;
  return (
    <TerminalProvider key={auth.user.id}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
        <Stack.Screen name="(tabs)" />
      </Stack>
    </TerminalProvider>
  );
}

function AppContent() {
  const [fontsLoaded, fontError] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      void SplashScreen.hideAsync().catch((error) => {
        console.warn('Unable to hide the splash screen:', error);
      });
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <GestureHandlerRootView style={styles.root}>
              <AuthGate />
            </GestureHandlerRootView>
          </AuthProvider>
        </QueryClientProvider>
    </SafeAreaProvider>
  );
}

export default function RootLayout() {
  return <ErrorBoundary><AppContent /></ErrorBoundary>;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
