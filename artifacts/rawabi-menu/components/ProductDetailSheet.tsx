import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  StyleSheet,
} from "react-native";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { useCart, CartCustomization } from "@/context/CartContext";
import { MenuItem } from "@/constants/menu";

const F = {
  regular: "Cairo_400Regular",
  semi: "Cairo_600SemiBold",
  bold: "Cairo_700Bold",
  extra: "Cairo_800ExtraBold",
};

const RICE_OPTIONS: { label: string; extra: number }[] = [
  { label: "أرز بشاور أبيض", extra: 0 },
  { label: "أرز مندي", extra: 0 },
];

const ADDON_OPTIONS: { label: string; extra: number }[] = [
  { label: "بدون كشنة", extra: 0 },
  { label: "زيادة كشنة", extra: 0 },
];

const RICE_CATS = new Set(["chicken", "meat", "mains"]);

function itemNeedsCustomization(item: MenuItem): boolean {
  if (!RICE_CATS.has(item.category)) return false;
  if (item.description?.includes("بدون رز")) return false;
  if (item.name.includes("سادة")) return false;
  if (item.name.startsWith("رز ")) return false;
  return true;
}

interface ChickenSizes {
  halfPrice: number;
  wholePrice: number;
  defaultIdx: number; // 0=نصف 1=حبة كاملة
}

function getChickenSizes(item: MenuItem): ChickenSizes | null {
  if (item.category !== "chicken") return null;
  if (item.name.startsWith("رز ")) return null;
  if (item.description?.includes("بدون رز") && item.name.includes("سادة")) return null;

  const isHalf = item.name.includes("نص") || item.name.includes("نصف");

  if (isHalf) {
    return { halfPrice: item.price, wholePrice: item.price * 2, defaultIdx: 0 };
  }
  // whole or unlabelled → treat as whole
  return { halfPrice: item.price / 2, wholePrice: item.price, defaultIdx: 1 };
}

interface MeatSizes {
  quarterPrice: number;
  halfPrice: number;
  wholePrice: number;
  defaultIdx: number; // 0=ربع 1=نصف 2=كامل
}

function getMeatSizes(item: MenuItem): MeatSizes | null {
  if (item.category !== "meat") return null;
  if (item.name.includes("نفر")) return null; // per-person serving, no size split

  const isQuarter = item.name.includes("ربع");
  const isHalf    = item.name.includes("نص") || item.name.includes("نصف");

  if (isQuarter) {
    return { quarterPrice: item.price, halfPrice: item.price * 2, wholePrice: item.price * 4, defaultIdx: 0 };
  }
  if (isHalf) {
    return { quarterPrice: item.price / 2, halfPrice: item.price, wholePrice: item.price * 2, defaultIdx: 1 };
  }
  // whole or unlabelled → treat as whole
  return { quarterPrice: item.price / 4, halfPrice: item.price / 2, wholePrice: item.price, defaultIdx: 2 };
}

interface Props {
  item: (MenuItem & { available?: boolean; nameEn?: string; descriptionEn?: string }) | null;
  visible: boolean;
  onClose: () => void;
}

export function ProductDetailSheet({ item, visible, onClose }: Props) {
  const colors = useColors();
  const { addItem } = useCart();

  const [qty, setQty] = useState(1);
  const [sizeIdx, setSizeIdx] = useState(0);
  const [meatSizeIdx, setMeatSizeIdx] = useState(2);
  const [riceIdx, setRiceIdx] = useState(0);
  const [addonIdx, setAddonIdx] = useState(0);

  useEffect(() => {
    if (visible && item) {
      setQty(1);
      setRiceIdx(0);
      setAddonIdx(0);
      const sizes = getChickenSizes(item);
      setSizeIdx(sizes?.defaultIdx ?? 0);
      const meatSizes = getMeatSizes(item);
      setMeatSizeIdx(meatSizes?.defaultIdx ?? 2);
    }
  }, [visible, item?.id]);

  if (!item) return null;

  const showCustomization = itemNeedsCustomization(item);
  const showRiceOptions = showCustomization && !item.name.includes("مضغوط");
  const selectedRice = showRiceOptions ? RICE_OPTIONS[riceIdx] : null;
  const selectedAddon = showCustomization ? ADDON_OPTIONS[addonIdx] : null;

  const sizes = getChickenSizes(item);
  const showSizeSelector = sizes !== null;

  const meatSizes = getMeatSizes(item);
  const showMeatSizeSelector = meatSizes !== null;

  const meatSizePrices = meatSizes
    ? [meatSizes.quarterPrice, meatSizes.halfPrice, meatSizes.wholePrice]
    : [];

  const chickenPrices = sizes
    ? [sizes.halfPrice, sizes.wholePrice]
    : [];

  const baseSizePrice = showSizeSelector
    ? chickenPrices[sizeIdx]
    : showMeatSizeSelector
      ? meatSizePrices[meatSizeIdx]
      : item.price;

  const riceExtra = selectedRice?.extra ?? 0;
  const addonExtra = selectedAddon?.extra ?? 0;
  const extraPrice = riceExtra + addonExtra;
  const unitPrice = baseSizePrice + extraPrice;
  const totalPrice = unitPrice * qty;
  const priceStr = (v: number) => v % 1 === 0 ? v.toString() : v.toFixed(1);

  const handleAdd = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const sizeLabel = showSizeSelector
      ? (["نصف", "حبة كاملة"][sizeIdx])
      : showMeatSizeSelector
        ? (["ربع", "نصف", "كامل"][meatSizeIdx])
        : undefined;

    const sizeExtraPrice = (showSizeSelector || showMeatSizeSelector)
      ? baseSizePrice - item.price
      : 0;

    const totalExtra = sizeExtraPrice + extraPrice;

    const customization: CartCustomization | undefined =
      (showSizeSelector || showMeatSizeSelector || showCustomization)
        ? {
            size: sizeLabel,
            riceType: selectedRice?.label,
            addon: selectedAddon?.label,
            extraPrice: totalExtra,
          }
        : undefined;

    addItem(item, qty, customization);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <TouchableOpacity style={styles.backdropTouch} onPress={onClose} activeOpacity={1} />

        <View style={[styles.sheet, { backgroundColor: colors.card }]}>
          {/* ── Close button ── */}
          <View style={styles.closeRow}>
            <TouchableOpacity onPress={onClose} style={[styles.closeBtn, { backgroundColor: colors.secondary }]}>
              <Feather name="x" size={18} color={colors.foreground} />
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 18, paddingBottom: 130, gap: 18 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* ── Item image (only when uploaded) ── */}
            {item.imageUrl ? (
              <Image
                source={{ uri: item.imageUrl }}
                style={styles.heroImg}
                contentFit="cover"
                transition={200}
              />
            ) : null}

            {/* ── Title ── */}
            <View style={{ gap: 4 }}>
              <Text style={{ color: colors.foreground, fontFamily: F.extra, fontSize: 20, textAlign: "right" }}>
                {item.name}
              </Text>
              {item.description ? (
                <Text style={{ color: colors.mutedForeground, fontFamily: F.regular, fontSize: 13, textAlign: "right" }}>
                  {item.description}
                </Text>
              ) : null}
            </View>

            {/* ── Size Selector (Chicken: نصف / حبة كاملة) ── */}
            {showSizeSelector && (
              <View style={{ gap: 10 }}>
                <Text style={[styles.sectionTitle, { color: colors.foreground }]}>الحجم</Text>
                <View style={{ flexDirection: "row", gap: 10 }}>
                  {([
                    { label: "نصف",        icon: "½", price: sizes!.halfPrice  },
                    { label: "حبة كاملة", icon: "1", price: sizes!.wholePrice },
                  ] as const).map((opt, i) => {
                    const active = sizeIdx === i;
                    return (
                      <TouchableOpacity
                        key={i}
                        onPress={() => { setSizeIdx(i); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                        style={[
                          styles.sizeBtn,
                          {
                            flex: 1,
                            backgroundColor: active ? "#C8171A" : colors.secondary,
                            borderColor: active ? "#C8171A" : colors.border,
                          },
                        ]}
                        activeOpacity={0.8}
                      >
                        <Text style={{ color: active ? "#fff" : colors.mutedForeground, fontFamily: F.extra, fontSize: 22 }}>
                          {opt.icon}
                        </Text>
                        <Text style={{ color: active ? "#fff" : colors.foreground, fontFamily: active ? F.bold : F.regular, fontSize: 14 }}>
                          {opt.label}
                        </Text>
                        <Text style={{ color: active ? "#ffee99" : colors.gold, fontFamily: F.bold, fontSize: 13 }}>
                          {priceStr(opt.price)} ر.س
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {/* ── Size Selector (Meat: ربع / نصف / كامل) ── */}
            {showMeatSizeSelector && (
              <View style={{ gap: 10 }}>
                <Text style={[styles.sectionTitle, { color: colors.foreground }]}>الحجم</Text>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  {([
                    { label: "ربع",   icon: "¼", price: meatSizes!.quarterPrice },
                    { label: "نصف",   icon: "½", price: meatSizes!.halfPrice    },
                    { label: "كامل",  icon: "1", price: meatSizes!.wholePrice   },
                  ] as const).map((opt, i) => {
                    const active = meatSizeIdx === i;
                    return (
                      <TouchableOpacity
                        key={i}
                        onPress={() => { setMeatSizeIdx(i); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                        style={[
                          styles.sizeBtn,
                          {
                            flex: 1,
                            backgroundColor: active ? "#C8171A" : colors.secondary,
                            borderColor: active ? "#C8171A" : colors.border,
                          },
                        ]}
                        activeOpacity={0.8}
                      >
                        <Text style={{ color: active ? "#fff" : colors.mutedForeground, fontFamily: F.extra, fontSize: 22 }}>
                          {opt.icon}
                        </Text>
                        <Text style={{ color: active ? "#fff" : colors.foreground, fontFamily: active ? F.bold : F.regular, fontSize: 14 }}>
                          {opt.label}
                        </Text>
                        <Text style={{ color: active ? "#ffee99" : colors.gold, fontFamily: F.bold, fontSize: 13 }}>
                          {priceStr(opt.price)} ر.س
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {/* ── Rice Type ── */}
            {showRiceOptions && (
              <View style={{ gap: 10 }}>
                <Text style={[styles.sectionTitle, { color: colors.foreground }]}>أنواع الأرز</Text>
                {RICE_OPTIONS.map((opt, i) => (
                  <TouchableOpacity
                    key={i}
                    onPress={() => { setRiceIdx(i); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                    style={styles.optionRow}
                    activeOpacity={0.7}
                  >
                    <View style={[
                      styles.radio,
                      { borderColor: riceIdx === i ? "#E8920C" : colors.border },
                      riceIdx === i && { backgroundColor: "#E8920C22" },
                    ]}>
                      {riceIdx === i && (
                        <View style={[styles.radioDot, { backgroundColor: "#E8920C" }]} />
                      )}
                    </View>
                    <Text style={{ flex: 1, color: colors.foreground, fontFamily: riceIdx === i ? F.bold : F.regular, fontSize: 15, textAlign: "right" }}>
                      {opt.label}
                    </Text>
                    {opt.extra > 0 && (
                      <View style={styles.extraBadge}>
                        <Text style={{ color: "#E8920C", fontFamily: F.bold, fontSize: 12 }}>
                          + {opt.extra} ر.س
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* ── Add-ons ── */}
            {showCustomization && (
              <View style={{ gap: 10 }}>
                <Text style={[styles.sectionTitle, { color: colors.foreground }]}>الإضافات</Text>
                {ADDON_OPTIONS.map((opt, i) => (
                  <TouchableOpacity
                    key={i}
                    onPress={() => { setAddonIdx(i); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                    style={styles.optionRow}
                    activeOpacity={0.7}
                  >
                    <View style={[
                      styles.radio,
                      { borderColor: addonIdx === i ? "#E8920C" : colors.border },
                      addonIdx === i && { backgroundColor: "#E8920C22" },
                    ]}>
                      {addonIdx === i && (
                        <View style={[styles.radioDot, { backgroundColor: "#E8920C" }]} />
                      )}
                    </View>
                    <Text style={{ flex: 1, color: colors.foreground, fontFamily: addonIdx === i ? F.bold : F.regular, fontSize: 15, textAlign: "right" }}>
                      {opt.label}
                    </Text>
                    {opt.extra > 0 && (
                      <View style={styles.extraBadge}>
                        <Text style={{ color: "#E8920C", fontFamily: F.bold, fontSize: 12 }}>
                          + {opt.extra} ر.س
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </ScrollView>

          {/* ── Fixed Footer: Qty + Add ── */}
          <View style={[styles.footer, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
            <View style={styles.qtyRow}>
              <TouchableOpacity
                onPress={() => { if (qty < 99) { setQty(qty + 1); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } }}
                style={[styles.qtyBtn, { backgroundColor: "#2A1508" }]}
              >
                <Feather name="plus" size={18} color="#E8920C" />
              </TouchableOpacity>
              <Text style={{ color: colors.foreground, fontFamily: F.extra, fontSize: 20, minWidth: 28, textAlign: "center" }}>
                {qty}
              </Text>
              <TouchableOpacity
                onPress={() => { if (qty > 1) { setQty(qty - 1); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } }}
                style={[styles.qtyBtn, { backgroundColor: "#2A1508" }]}
              >
                <Feather name="minus" size={18} color={qty <= 1 ? colors.border : "#E8920C"} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              onPress={handleAdd}
              style={[styles.addBtn, { backgroundColor: "#C8171A" }]}
              activeOpacity={0.85}
            >
              <Text style={{ color: "#fff", fontFamily: F.extra, fontSize: 17 }}>
                {priceStr(totalPrice)} ر.س
              </Text>
              <Text style={{ color: "#ffee99", fontFamily: F.bold, fontSize: 14 }}>إضافة للسلة</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "#00000080",
  },
  backdropTouch: {
    flex: 1,
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: "hidden",
    maxHeight: "88%",
  },
  heroImg: {
    width: "100%",
    height: 200,
    borderRadius: 16,
  },
  closeRow: {
    flexDirection: "row",
    justifyContent: "flex-start",
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 4,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: {
    fontFamily: "Cairo_700Bold",
    fontSize: 14,
    textAlign: "right",
    opacity: 0.6,
    marginBottom: 2,
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 4,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#ffffff18",
  },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  radioDot: {
    width: 11,
    height: 11,
    borderRadius: 6,
  },
  extraBadge: {
    minWidth: 44,
    alignItems: "flex-end",
  },
  sizeBtn: {
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    gap: 4,
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    paddingBottom: 28,
    borderTopWidth: 1,
    gap: 14,
  },
  qtyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  qtyBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  addBtn: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
});
