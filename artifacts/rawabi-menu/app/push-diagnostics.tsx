import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import {
  createPushDiagnosticsReport,
  loadPushDiagnostics,
  PROJECT_ID,
  PushDiagnosticStatus,
  PushDiagnosticsReport,
  runPushDiagnostics,
} from "@/hooks/useCustomerPushToken";

const F = {
  regular: "Cairo_400Regular",
  semi: "Cairo_600SemiBold",
  bold: "Cairo_700Bold",
  extra: "Cairo_800ExtraBold",
};

const STATUS_LABELS: Record<PushDiagnosticStatus, string> = {
  idle: "لم يبدأ",
  pending: "جارٍ الفحص",
  success: "نجح",
  error: "فشل",
  skipped: "تم تجاوزه",
};

function statusColor(status: PushDiagnosticStatus, colors: ReturnType<typeof useColors>) {
  if (status === "error") return colors.destructive;
  if (status === "success") return colors.accent;
  if (status === "pending") return colors.gold;
  return colors.mutedForeground;
}

function statusIcon(status: PushDiagnosticStatus): keyof typeof Feather.glyphMap {
  if (status === "success") return "check-circle";
  if (status === "error") return "x-circle";
  if (status === "pending") return "loader";
  if (status === "skipped") return "minus-circle";
  return "circle";
}

function formatRunAt(value: string | undefined) {
  if (!value) return "لم يُجرَ فحص بعد";
  try {
    return new Date(value).toLocaleString("ar-SA", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return value;
  }
}

export default function PushDiagnosticsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const mounted = useRef(true);
  const runningRef = useRef(false);
  const [report, setReport] = useState<PushDiagnosticsReport>(() => createPushDiagnosticsReport());
  const [running, setRunning] = useState(false);

  const runDiagnostics = useCallback(async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    setRunning(true);
    try {
      await runPushDiagnostics((nextReport) => {
        if (mounted.current) setReport(nextReport);
      });
    } finally {
      runningRef.current = false;
      if (mounted.current) setRunning(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    loadPushDiagnostics().then((stored) => {
      if (!mounted.current) return;
      if (stored) {
        setReport(stored);
      } else {
        runDiagnostics();
      }
    });
    return () => {
      mounted.current = false;
    };
  }, [runDiagnostics]);

  const topInset = Platform.OS === "web" ? 20 : insets.top;
  const lastStep = report.steps.find((step) => step.status === "error")
    ?? report.steps[report.steps.length - 1];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={colors.isLight ? "dark-content" : "light-content"} />

      <View
        style={[
          styles.header,
          {
            backgroundColor: colors.card,
            borderBottomColor: colors.border,
            paddingTop: topInset + 8,
          },
        ]}
      >
        <TouchableOpacity
          accessibilityLabel="رجوع"
          onPress={() => router.back()}
          style={styles.iconButton}
          testID="push-diagnostics-back"
        >
          <Feather name="arrow-right" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground, fontFamily: F.bold }]}>
          تشخيص الإشعارات
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 28 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.introCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.introIcon, { backgroundColor: colors.secondary }]}>
            <Feather name="bell" size={26} color={colors.gold} />
          </View>
          <Text style={[styles.title, { color: colors.foreground, fontFamily: F.extra }]}>
            فحص تسجيل iOS
          </Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground, fontFamily: F.regular }]}>
            يعرض هذا الفحص آخر نتيجة لكل مرحلة من الصلاحية حتى إرسال التوكن إلى Render.
          </Text>
          <View style={[styles.projectRow, { backgroundColor: colors.secondary }]}>
            <Text style={[styles.projectLabel, { color: colors.mutedForeground, fontFamily: F.regular }]}>
              Expo Project ID
            </Text>
            <Text selectable style={[styles.projectId, { color: colors.foreground, fontFamily: F.semi }]}>
              {PROJECT_ID}
            </Text>
          </View>
        </View>

        <View style={[styles.metaCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Feather name="clock" size={15} color={colors.mutedForeground} />
          <Text style={[styles.metaText, { color: colors.mutedForeground, fontFamily: F.regular }]}>
            آخر فحص: {formatRunAt(report.runAt)}
          </Text>
        </View>

        <View style={styles.steps}>
          {report.steps.map((step) => {
            const color = statusColor(step.status, colors);
            return (
              <View
                key={step.id}
                style={[styles.stepCard, { backgroundColor: colors.card, borderColor: colors.border }]}
              >
                <View style={[styles.statusIcon, { backgroundColor: color + "1F" }]}>
                  {step.status === "pending" ? (
                    <ActivityIndicator size="small" color={color} />
                  ) : (
                    <Feather name={statusIcon(step.status)} size={20} color={color} />
                  )}
                </View>
                <View style={styles.stepBody}>
                  <View style={styles.stepTitleRow}>
                    <Text style={[styles.stepTitle, { color: colors.foreground, fontFamily: F.bold }]}>
                      {step.title}
                    </Text>
                    <Text style={[styles.statusLabel, { color, fontFamily: F.bold }]}>
                      {STATUS_LABELS[step.status]}
                    </Text>
                  </View>
                  <Text style={[styles.stepMessage, { color: colors.mutedForeground, fontFamily: F.regular }]}>
                    {step.message}
                  </Text>
                  {step.detail ? (
                    <Text selectable style={[styles.detail, { color: colors.foreground, fontFamily: F.regular }]}>
                      {step.detail}
                    </Text>
                  ) : null}
                </View>
              </View>
            );
          })}
        </View>

        <View style={[styles.tokenCard, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
          <View style={styles.tokenHeader}>
            <Feather name="shield" size={17} color={colors.gold} />
            <Text style={[styles.tokenTitle, { color: colors.foreground, fontFamily: F.bold }]}>
              Expo Push Token
            </Text>
          </View>
          <Text selectable style={[styles.tokenValue, { color: colors.gold, fontFamily: F.semi }]}>
            {report.tokenPreview ?? "لم يتم استخراج توكن بعد"}
          </Text>
          <Text style={[styles.tokenHint, { color: colors.mutedForeground, fontFamily: F.regular }]}>
            يظهر التوكن هنا بشكل مقنّع فقط. لا يتم عرض المفاتيح أو القيم السرية.
          </Text>
        </View>

        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="إعادة فحص الإشعارات"
          disabled={running}
          onPress={runDiagnostics}
          style={[
            styles.runButton,
            { backgroundColor: running ? colors.secondary : colors.primary },
          ]}
          activeOpacity={0.85}
          testID="run-push-diagnostics"
        >
          {running ? (
            <ActivityIndicator color={colors.primaryForeground} />
          ) : (
            <Feather name="refresh-cw" size={18} color={colors.primaryForeground} />
          )}
          <Text style={[styles.runButtonText, { color: colors.primaryForeground, fontFamily: F.bold }]}>
            {running ? "جارٍ تشغيل الفحص…" : "إعادة تشغيل الفحص"}
          </Text>
        </TouchableOpacity>

        {lastStep?.status === "error" ? (
          <Text style={[styles.stopNote, { color: colors.destructive, fontFamily: F.regular }]}>
            توجد مرحلة فاشلة. راجع الخطأ الظاهر ثم أعد تشغيل الفحص.
          </Text>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    minHeight: 68,
    paddingHorizontal: 18,
    paddingBottom: 12,
    borderBottomWidth: 1,
    flexDirection: "row-reverse",
    alignItems: "center",
  },
  headerTitle: { flex: 1, textAlign: "center", fontSize: 19 },
  headerSpacer: { width: 42 },
  iconButton: { width: 42, height: 42, alignItems: "center", justifyContent: "center" },
  content: { padding: 16, gap: 12 },
  introCard: { borderRadius: 18, borderWidth: 1, padding: 20, alignItems: "center", gap: 8 },
  introIcon: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center", marginBottom: 2 },
  title: { fontSize: 22, textAlign: "center" },
  subtitle: { fontSize: 13, lineHeight: 21, textAlign: "center" },
  projectRow: { width: "100%", borderRadius: 10, padding: 10, gap: 3, marginTop: 5 },
  projectLabel: { fontSize: 11, textAlign: "right" },
  projectId: { fontSize: 11, textAlign: "right" },
  metaCard: { borderRadius: 12, borderWidth: 1, padding: 11, flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 7 },
  metaText: { fontSize: 12 },
  steps: { gap: 10 },
  stepCard: { borderRadius: 15, borderWidth: 1, padding: 14, flexDirection: "row-reverse", alignItems: "flex-start", gap: 12 },
  statusIcon: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  stepBody: { flex: 1, gap: 4 },
  stepTitleRow: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", gap: 8 },
  stepTitle: { flex: 1, fontSize: 15, textAlign: "right" },
  statusLabel: { fontSize: 11 },
  stepMessage: { fontSize: 13, lineHeight: 20, textAlign: "right" },
  detail: { fontSize: 11, lineHeight: 17, textAlign: "right" },
  tokenCard: { borderRadius: 15, borderWidth: 1, padding: 15, gap: 8 },
  tokenHeader: { flexDirection: "row-reverse", alignItems: "center", gap: 8 },
  tokenTitle: { fontSize: 14 },
  tokenValue: { fontSize: 12, textAlign: "right" },
  tokenHint: { fontSize: 11, lineHeight: 18, textAlign: "right" },
  runButton: { minHeight: 52, borderRadius: 14, flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 9 },
  runButtonText: { fontSize: 15 },
  stopNote: { fontSize: 12, lineHeight: 19, textAlign: "center" },
});