import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '../hooks/useColors';
import { useAuth } from '../lib/AuthContext';
import { Btn, Field, INK, Notice, Txt } from './ui';

export function LoginScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const auth = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [localErr, setLocalErr] = useState<string | null>(null);
  const error: string | null = localErr ?? auth.error ?? null;

  const submit = async () => {
    if (!username.trim() || !password) { setLocalErr('أدخل اسم المستخدم وكلمة المرور'); return; }
    setLocalErr(null); setBusy(true);
    try { await auth.login(username.trim(), password); }
    catch (e) { setLocalErr(e instanceof Error ? e.message : 'تعذر تسجيل الدخول'); }
    finally { setBusy(false); }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 24, paddingTop: insets.top + 32, justifyContent: 'center', gap: 18 }} keyboardShouldPersistTaps="handled">
        <View style={{ alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <View style={{ width: 84, height: 84, borderRadius: 24, backgroundColor: INK, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 5, borderBottomColor: c.primary }}>
            <MaterialIcons name="receipt-long" size={42} color={c.primary} />
          </View>
          <Txt style={{ fontFamily: 'Inter_700Bold', fontSize: 30, textAlign: 'center' }}>چڤن</Txt>
          <Txt muted style={{ textAlign: 'center' }}>مكتب طلبات مطعم روابي</Txt>
        </View>
        <Field label="اسم المستخدم" value={username} onChangeText={setUsername} autoCapitalize="none" autoCorrect={false} textContentType="username" testID="login-username" />
        <Field label="كلمة المرور" value={password} onChangeText={setPassword} secureTextEntry textContentType="password" testID="login-password" onSubmitEditing={submit} />
        {error ? <Notice tone="warn" text={error} /> : null}
        <Btn label="تسجيل الدخول" icon="login" onPress={submit} loading={busy} testID="login-submit" />
        <Txt muted style={{ textAlign: 'center', fontSize: 13 }}>تبقى الجلسة محفوظة على هذا الجهاز عبر ملف تعريف الخادم. لا يتم حفظ كلمة المرور.</Txt>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
