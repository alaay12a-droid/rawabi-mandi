import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  Platform,
  StatusBar,
  Animated,
  KeyboardAvoidingView,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useColors } from "@/hooks/useColors";
import { useUser } from "@/context/UserContext";
import { apiPost, apiGet } from "@/constants/api";

const F = {
  regular: "Cairo_400Regular",
  semi: "Cairo_600SemiBold",
  bold: "Cairo_700Bold",
  extra: "Cairo_800ExtraBold",
};

const CARDS_KEY = "@rawabi_saved_cards";

interface SavedCard {
  id: string;
  number: string;
  expiry: string;
  cvv: string;
}

type SheetStep = "form" | "otp";

function maskCard(num: string) {
  const clean = num.replace(/\s/g, "");
  if (clean.length < 4) return num;
  return "**** **** **** " + clean.slice(-4);
}

function formatCardNumber(val: string) {
  const digits = val.replace(/\D/g, "").slice(0, 16);
  return digits.replace(/(.{4})/g, "$1 ").trim();
}

function formatExpiry(val: string) {
  const digits = val.replace(/\D/g, "").slice(0, 4);
  if (digits.length >= 3) return digits.slice(0, 2) + "/" + digits.slice(2);
  return digits;
}

function getCardType(num: string) {
  const n = num.replace(/\s/g, "");
  if (/^4/.test(n)) return "visa";
  if (/^5[1-5]/.test(n) || /^2[2-7]/.test(n)) return "mastercard";
  if (/^3[47]/.test(n)) return "amex";
  if (/^6/.test(n)) return "mada";
  return "generic";
}

function CardBadge({ type, size = 28 }: { type: string; size?: number }) {
  const map: Record<string, { bg: string; label: string }> = {
    visa:       { bg: "#1A1F71", label: "VISA" },
    mastercard: { bg: "#EB001B", label: "MC" },
    mada:       { bg: "#008000", label: "مدى" },
    amex:       { bg: "#2E77BC", label: "AMEX" },
    generic:    { bg: "#555",    label: "💳" },
  };
  const { bg, label } = map[type] ?? map.generic;
  return (
    <View style={{
      width: size + 16, height: size,
      borderRadius: 6,
      backgroundColor: bg + "22",
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: bg + "66",
    }}>
      <Text style={{ color: bg === "#555" ? "#aaa" : bg, fontFamily: F.bold, fontSize: size * 0.38 }}>{label}</Text>
    </View>
  );
}

export default function PaymentMethodsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useUser();
  const topInset = Platform.OS === "web" ? 20 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;

  const [cards, setCards] = useState<SavedCard[]>([]);

  // Sheet state
  const [showSheet, setShowSheet] = useState(false);
  const [step, setStep] = useState<SheetStep>("form");

  // Form fields
  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");

  // OTP state
  const [otpCode, setOtpCode] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pendingCard, setPendingCard] = useState<SavedCard | null>(null);

  // Animation
  const slideAnim = useRef(new Animated.Value(500)).current;
  const fadeAnim  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    AsyncStorage.getItem(CARDS_KEY).then((val) => {
      if (val) setCards(JSON.parse(val));
    });
  }, []);

  const openSheet = () => {
    setCardNumber("");
    setExpiry("");
    setCvv("");
    setOtpCode("");
    setStep("form");
    setPendingCard(null);
    setShowSheet(true);
    Animated.parallel([
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, damping: 18, stiffness: 180 }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
  };

  const closeSheet = () => {
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: 500, duration: 220, useNativeDriver: true }),
      Animated.timing(fadeAnim,  { toValue: 0,   duration: 200, useNativeDriver: true }),
    ]).start(() => { setShowSheet(false); setStep("form"); });
  };

  // ── Step 1: Validate card + send OTP ──
  const handleSubmitCard = async () => {
    const digits = cardNumber.replace(/\s/g, "");
    if (digits.length < 13) { Alert.alert("خطأ", "رقم البطاقة غير صحيح"); return; }
    if (!expiry || expiry.length < 5) { Alert.alert("خطأ", "تاريخ الانتهاء غير صحيح"); return; }
    if (!cvv || cvv.length < 3) { Alert.alert("خطأ", "رمز CVV غير صحيح"); return; }

    if (!user?.phone) {
      Alert.alert("خطأ", "يجب تسجيل رقم جوالك أولاً");
      return;
    }

    setSaving(true);
    const card: SavedCard = { id: Date.now().toString(), number: cardNumber, expiry, cvv };
    setPendingCard(card);

    try {
      const smsSettings = await apiGet<{ enabled: boolean }>("/sms-settings");

      if (!smsSettings.enabled) {
        // SMS disabled — save directly
        await saveCard(card);
        return;
      }

      // Send OTP
      const r = await apiPost<{ ok: boolean; skipped?: boolean }>("/sms/send-otp", { phone: user.phone });

      if (r.skipped) {
        // OTP skipped (dev mode) — save directly
        await saveCard(card);
        return;
      }

      // Move to OTP step
      setOtpCode("");
      setStep("otp");
    } catch {
      Alert.alert("خطأ", "تعذر إرسال رمز التحقق، حاول مرة أخرى.");
    } finally {
      setSaving(false);
    }
  };

  // ── Step 2: Verify OTP + save card ──
  const handleVerifyOtp = async () => {
    if (!user?.phone || !pendingCard) return;
    if (otpCode.length !== 4) { Alert.alert("خطأ", "الرمز يتكون من 4 أرقام"); return; }

    setOtpLoading(true);
    try {
      await apiPost("/sms/verify-otp", { phone: user.phone, code: otpCode });
      await saveCard(pendingCard);
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message ?? "الرمز غير صحيح، حاول مرة أخرى";
      Alert.alert("خطأ في التحقق", msg);
    } finally {
      setOtpLoading(false);
    }
  };

  // Resend OTP
  const handleResend = async () => {
    if (!user?.phone) return;
    setOtpLoading(true);
    try {
      await apiPost("/sms/send-otp", { phone: user.phone });
      setOtpCode("");
      Alert.alert("✅", "تم إعادة إرسال الرمز");
    } catch {
      Alert.alert("خطأ", "تعذر إرسال الرمز");
    } finally {
      setOtpLoading(false);
    }
  };

  const saveCard = async (card: SavedCard) => {
    const updated = [...cards, card];
    await AsyncStorage.setItem(CARDS_KEY, JSON.stringify(updated));
    setCards(updated);
    closeSheet();
  };

  const handleDelete = (id: string) => {
    Alert.alert("حذف البطاقة", "هل تريد حذف هذه البطاقة؟", [
      { text: "إلغاء", style: "cancel" },
      {
        text: "حذف",
        style: "destructive",
        onPress: async () => {
          const updated = cards.filter((c) => c.id !== id);
          await AsyncStorage.setItem(CARDS_KEY, JSON.stringify(updated));
          setCards(updated);
        },
      },
    ]);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={[styles.header, { paddingTop: topInset + 10, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Feather name="arrow-right" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground, fontFamily: F.extra }]}>طرق الدفع</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: bottomInset + 110, gap: 14 }}>
        {cards.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Feather name="credit-card" size={56} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground, fontFamily: F.bold }]}>لا يوجد طرق دفع</Text>
            <Text style={[styles.emptySub, { color: colors.mutedForeground, fontFamily: F.regular }]}>أضف بطاقتك للدفع السريع</Text>
          </View>
        ) : (
          cards.map((card) => {
            const type = getCardType(card.number);
            return (
              <View key={card.id} style={[styles.cardRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <TouchableOpacity
                  onPress={() => handleDelete(card.id)}
                  style={styles.deleteBtn}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Feather name="trash-2" size={16} color={colors.destructive} />
                </TouchableOpacity>
                <View style={{ flex: 1, alignItems: "flex-end", gap: 4 }}>
                  <Text style={[styles.cardNum, { color: colors.foreground, fontFamily: F.bold }]}>
                    {maskCard(card.number)}
                  </Text>
                  <Text style={[styles.cardExpiry, { color: colors.mutedForeground, fontFamily: F.regular }]}>
                    ينتهي {card.expiry}
                  </Text>
                </View>
                <CardBadge type={type} size={32} />
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Add Button */}
      <View style={[styles.fabWrap, { paddingBottom: bottomInset + 16 }]}>
        <TouchableOpacity onPress={openSheet} style={[styles.fab, { backgroundColor: colors.gold }]} activeOpacity={0.85}>
          <Feather name="plus" size={18} color="#1A0A00" />
          <Text style={[styles.fabText, { color: "#1A0A00", fontFamily: F.bold }]}>ادخل بيانات البطاقة</Text>
        </TouchableOpacity>
      </View>

      {/* Bottom Sheet */}
      {showSheet && (
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, { opacity: fadeAnim }]}>
            <Pressable style={StyleSheet.absoluteFill} onPress={closeSheet} />
          </Animated.View>

          <Animated.View
            style={[styles.sheet, { backgroundColor: colors.card, paddingBottom: bottomInset + 24, transform: [{ translateY: slideAnim }] }]}
          >
            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
              <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />

              {/* ── STEP 1: Card Form ── */}
              {step === "form" && (
                <>
                  <Text style={[styles.sheetTitle, { color: colors.foreground, fontFamily: F.extra }]}>
                    إضافة بطاقة جديدة
                  </Text>

                  {/* Card Number */}
                  <Text style={[styles.fieldLabel, { color: colors.mutedForeground, fontFamily: F.semi }]}>رقم البطاقة</Text>
                  <View style={[styles.inputRow, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                    {cardNumber.length > 0 && <CardBadge type={getCardType(cardNumber)} size={22} />}
                    <TextInput
                      value={cardNumber}
                      onChangeText={(v) => setCardNumber(formatCardNumber(v))}
                      placeholder="0000 0000 0000 0000"
                      placeholderTextColor={colors.mutedForeground}
                      keyboardType="number-pad"
                      maxLength={19}
                      style={[styles.inputFlex, { color: colors.foreground, fontFamily: F.bold }]}
                    />
                  </View>

                  {/* Expiry + CVV */}
                  <View style={{ flexDirection: "row-reverse", gap: 12, marginTop: 4 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.fieldLabel, { color: colors.mutedForeground, fontFamily: F.semi }]}>MM/YY</Text>
                      <TextInput
                        value={expiry}
                        onChangeText={(v) => setExpiry(formatExpiry(v))}
                        placeholder="MM/YY"
                        placeholderTextColor={colors.mutedForeground}
                        keyboardType="number-pad"
                        maxLength={5}
                        style={[styles.inputCenter, { backgroundColor: colors.secondary, borderColor: colors.border, color: colors.foreground, fontFamily: F.bold }]}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.fieldLabel, { color: colors.mutedForeground, fontFamily: F.semi }]}>CVV</Text>
                      <TextInput
                        value={cvv}
                        onChangeText={(v) => setCvv(v.replace(/\D/g, "").slice(0, 4))}
                        placeholder="•••"
                        placeholderTextColor={colors.mutedForeground}
                        keyboardType="number-pad"
                        maxLength={4}
                        secureTextEntry
                        style={[styles.inputCenter, { backgroundColor: colors.secondary, borderColor: colors.border, color: colors.foreground, fontFamily: F.bold }]}
                      />
                    </View>
                  </View>

                  {/* Phone hint */}
                  {user?.phone && (
                    <View style={[styles.phoneHint, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                      <Feather name="shield" size={14} color={colors.gold} />
                      <Text style={{ color: colors.mutedForeground, fontFamily: F.regular, fontSize: 12, flex: 1, textAlign: "right" }}>
                        سيُرسل رمز تحقق إلى {user.phone}
                      </Text>
                    </View>
                  )}

                  <TouchableOpacity
                    onPress={handleSubmitCard}
                    disabled={saving}
                    style={[styles.mainBtn, { backgroundColor: colors.gold, marginTop: 16 }]}
                  >
                    {saving
                      ? <ActivityIndicator color="#1A0A00" />
                      : <Text style={[styles.mainBtnText, { color: "#1A0A00", fontFamily: F.bold }]}>إرسال رمز التحقق →</Text>
                    }
                  </TouchableOpacity>
                </>
              )}

              {/* ── STEP 2: OTP Verification ── */}
              {step === "otp" && (
                <>
                  <View style={{ alignItems: "center", marginBottom: 8, gap: 6 }}>
                    <View style={[styles.otpIconWrap, { backgroundColor: colors.gold + "22" }]}>
                      <Feather name="message-square" size={28} color={colors.gold} />
                    </View>
                    <Text style={[styles.sheetTitle, { color: colors.foreground, fontFamily: F.extra, marginBottom: 0 }]}>
                      رمز التحقق
                    </Text>
                    <Text style={{ color: colors.mutedForeground, fontFamily: F.regular, fontSize: 13, textAlign: "center" }}>
                      أُرسل رمز مكوّن من 4 أرقام إلى{"\n"}
                      <Text style={{ color: colors.foreground, fontFamily: F.bold }}>{user?.phone}</Text>
                    </Text>
                  </View>

                  {/* OTP boxes */}
                  <TextInput
                    value={otpCode}
                    onChangeText={(v) => setOtpCode(v.replace(/\D/g, "").slice(0, 4))}
                    keyboardType="number-pad"
                    maxLength={4}
                    autoFocus
                    style={[styles.otpInput, {
                      backgroundColor: colors.secondary,
                      borderColor: otpCode.length === 4 ? colors.gold : colors.border,
                      color: colors.gold,
                      fontFamily: F.extra,
                    }]}
                    placeholder="- - - -"
                    placeholderTextColor={colors.mutedForeground}
                  />

                  <TouchableOpacity
                    onPress={handleVerifyOtp}
                    disabled={otpLoading || otpCode.length !== 4}
                    style={[styles.mainBtn, {
                      backgroundColor: otpCode.length === 4 ? colors.gold : colors.secondary,
                      borderWidth: 1,
                      borderColor: otpCode.length === 4 ? colors.gold : colors.border,
                      marginTop: 16,
                    }]}
                  >
                    {otpLoading
                      ? <ActivityIndicator color={otpCode.length === 4 ? "#1A0A00" : colors.mutedForeground} />
                      : <Text style={{ color: otpCode.length === 4 ? "#1A0A00" : colors.mutedForeground, fontFamily: F.bold, fontSize: 15 }}>
                          ✅ تحقق وحفظ البطاقة
                        </Text>
                    }
                  </TouchableOpacity>

                  {/* Resend + Back */}
                  <View style={{ flexDirection: "row-reverse", justifyContent: "space-between", marginTop: 14 }}>
                    <TouchableOpacity onPress={handleResend} disabled={otpLoading}>
                      <Text style={{ color: colors.gold, fontFamily: F.semi, fontSize: 13 }}>إعادة الإرسال</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setStep("form")} disabled={otpLoading}>
                      <Text style={{ color: colors.mutedForeground, fontFamily: F.semi, fontSize: 13 }}>← تعديل البطاقة</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </KeyboardAvoidingView>
          </Animated.View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row-reverse",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    justifyContent: "space-between",
  },
  headerTitle: { fontSize: 20 },
  backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  emptyWrap: { alignItems: "center", justifyContent: "center", paddingTop: 80, gap: 12 },
  emptyTitle: { fontSize: 18 },
  emptySub: { fontSize: 13 },
  cardRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 14,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
  },
  cardNum: { fontSize: 16, letterSpacing: 2 },
  cardExpiry: { fontSize: 13 },
  deleteBtn: { padding: 6 },
  fabWrap: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 20 },
  fab: {
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  fabText: { fontSize: 16 },
  backdrop: { backgroundColor: "#000000BB" },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 22,
  },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 18 },
  sheetTitle: { fontSize: 20, textAlign: "center", marginBottom: 18 },
  fieldLabel: { fontSize: 13, textAlign: "right", marginBottom: 6, marginTop: 10 },
  inputRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    gap: 10,
  },
  inputFlex: { flex: 1, paddingVertical: 14, fontSize: 17, textAlign: "right" },
  inputCenter: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 14, fontSize: 17, textAlign: "center" },
  phoneHint: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 10,
  },
  mainBtn: { borderRadius: 14, paddingVertical: 15, alignItems: "center" },
  mainBtnText: { fontSize: 16 },
  otpIconWrap: { width: 60, height: 60, borderRadius: 30, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  otpInput: {
    borderRadius: 16,
    borderWidth: 2,
    paddingVertical: 16,
    fontSize: 36,
    textAlign: "center",
    letterSpacing: 16,
    marginTop: 10,
  },
});
