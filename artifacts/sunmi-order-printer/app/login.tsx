import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { useColors } from '../hooks/useColors';

export default function LoginScreen() {
  const colors = useColors();
  const { user, login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user) router.replace('/(tabs)');
  }, [user]);

  const submit = async () => {
    if (!username.trim() || !password) {
      setError('اسم المستخدم وكلمة المرور مطلوبان');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await login(username, password);
      router.replace('/(tabs)');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذر تسجيل الدخول');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Image
          source={require('../assets/images/logo.png')}
          style={styles.logo}
          resizeMode="contain"
          accessibilityLabel="شعار روابي المندي"
        />
        <Text style={[styles.title, { color: colors.foreground }]}>روابي المندي</Text>
        <Text style={[styles.subtitle, { color: colors.primary }]}>نظام استقبال وطباعة الطلبات</Text>
        <Text style={[styles.description, { color: colors.mutedForeground }]}>
          استخدم حساب لوحة روابي المخصص للفرع. لا تُحفظ كلمة المرور داخل التطبيق.
        </Text>
        <TextInput
          value={username}
          onChangeText={setUsername}
          placeholder="اسم المستخدم"
          placeholderTextColor={colors.mutedForeground}
          autoCapitalize="none"
          style={[styles.input, { color: colors.foreground, borderColor: colors.border }]}
          testID="sunmi-login-username"
        />
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="كلمة المرور"
          placeholderTextColor={colors.mutedForeground}
          secureTextEntry
          style={[styles.input, { color: colors.foreground, borderColor: colors.border }]}
          testID="sunmi-login-password"
        />
        {error ? <Text style={[styles.error, { color: colors.destructive }]}>{error}</Text> : null}
        <Pressable
          onPress={submit}
          disabled={submitting}
          style={[styles.button, { backgroundColor: colors.primary, opacity: submitting ? 0.6 : 1 }]}
          testID="sunmi-login-submit"
        >
          {submitting ? <ActivityIndicator color={colors.primaryForeground} /> : (
            <Text style={[styles.buttonText, { color: colors.primaryForeground }]}>دخول</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, justifyContent: 'center', padding: 22 },
  card: { borderWidth: 1, borderRadius: 18, padding: 22 },
  logo: { width: '100%', height: 130, alignSelf: 'center', marginBottom: 12 },
  title: { fontSize: 24, fontFamily: 'Inter_700Bold', textAlign: 'center' },
  subtitle: { fontSize: 15, fontFamily: 'Inter_600SemiBold', textAlign: 'center', marginTop: 4 },
  description: { fontSize: 14, lineHeight: 22, fontFamily: 'Inter_400Regular', textAlign: 'right', marginTop: 14, marginBottom: 20 },
  input: { borderWidth: 1, borderRadius: 10, padding: 15, textAlign: 'right', marginBottom: 12, fontSize: 16 },
  error: { textAlign: 'right', marginBottom: 12, fontFamily: 'Inter_500Medium' },
  button: { minHeight: 54, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontSize: 17, fontFamily: 'Inter_700Bold' },
});