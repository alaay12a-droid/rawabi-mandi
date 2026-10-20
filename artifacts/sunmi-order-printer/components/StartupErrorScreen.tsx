import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

type Props = { error: Error; resetError: () => void };

// No font loader, safe-area context, icon package, router, or printer dependency:
// this screen must also work when one of those startup providers has failed.
export function StartupErrorScreen({ error, resetError }: Props) {
  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>تعذر بدء تطبيق الطابعة</Text>
        <Text style={styles.text}>صوّر تفاصيل الخطأ التالية وأرسلها للدعم. لا يلزم حذف التطبيق أو بياناته.</Text>
        <Text selectable style={styles.details}>{String(error?.message || error)}</Text>
        <Text selectable style={styles.stack}>{error?.stack?.slice(0, 4000)}</Text>
        <Pressable accessibilityRole="button" onPress={resetError} style={styles.button}>
          <Text style={styles.buttonText}>إعادة المحاولة</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fffaf4' },
  content: { flexGrow: 1, justifyContent: 'center', padding: 24, paddingTop: 48, paddingBottom: 48 },
  title: { fontSize: 24, fontWeight: '700', textAlign: 'right', color: '#302316', marginBottom: 16 },
  text: { fontSize: 16, lineHeight: 25, textAlign: 'right', color: '#564a3f', marginBottom: 20 },
  details: { fontSize: 17, color: '#a22121', marginBottom: 16, textAlign: 'right' },
  stack: { fontSize: 12, color: '#564a3f', marginBottom: 24 },
  button: { backgroundColor: '#805331', minHeight: 48, padding: 14, borderRadius: 10 },
  buttonText: { color: '#fff', fontSize: 17, textAlign: 'center', fontWeight: '600' },
});
