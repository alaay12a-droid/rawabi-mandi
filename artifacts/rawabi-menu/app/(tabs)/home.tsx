import React, { useState, useMemo, useRef, useCallback, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Linking,
  StatusBar,
} from "react-native";
import { FlashList } from "@shopify/flash-list";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { useUser } from "@/context/UserContext";
import { useFavorites } from "@/hooks/useFavorites";
import { useLanguage } from "@/context/LanguageContext";
import { useAppTexts } from "@/hooks/useAppTexts";
import { useMenu } from "@/hooks/useMenu";
import { useBanners } from "@/hooks/useBanners";
import { MenuItemCard } from "@/components/MenuItemCard";
import { BannerCarousel } from "@/components/BannerCarousel";
import { CartBar } from "@/components/CartBar";
import { useCartState } from "@/context/CartContext";
import type { MenuItem } from "@/constants/menu";

const F = {
  regular: "Cairo_400Regular",
  semi: "Cairo_600SemiBold",
  bold: "Cairo_700Bold",
  extra: "Cairo_800ExtraBold",
};

const BRANCH_ADDRESS = "تبوك — حي الروضة";
const BRANCH_MAPS_URL = "https://maps.google.com/?q=تبوك+حي+الروضة+روابي+المندي";

type OrderMode = "delivery" | "pickup";
type RawItem = MenuItem & { available?: boolean; nameEn?: string; descriptionEn?: string; stock?: number | null };

// ── Flat list entry types for virtualization ──────────────────────────────
type ListEntry =
  | { _t: "favHeader" }
  | { _t: "item"; item: RawItem }
  | { _t: "catHeader"; name: string; icon: string; count: number }
  | { _t: "searchResult"; item: RawItem };

// ── HomeItemRow: zero context subscriptions — quantity passed as prop ─────
const HomeItemRow = React.memo(function HomeItemRow({
  item, quantity, isEn, whatsapp, isFavoriteFn, onToggleFav,
}: {
  item: RawItem;
  quantity: number;
  isEn: boolean;
  whatsapp: string;
  isFavoriteFn: (id: string) => boolean;
  onToggleFav: (id: string) => void;
}) {
  const isFav = isFavoriteFn(item.id);
  const handleToggle = useCallback(() => onToggleFav(item.id), [onToggleFav, item.id]);
  return (
    <View style={{ paddingHorizontal: 16, paddingTop: 6 }}>
      <MenuItemCard
        item={item}
        quantity={quantity}
        isEn={isEn}
        isFavorite={isFav}
        onToggleFavorite={handleToggle}
        whatsapp={whatsapp}
      />
    </View>
  );
});

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const router = useRouter();
  const { user } = useUser();
  const { favorites, isFavorite: isFavoriteFn, toggleFavorite } = useFavorites();
  const { language } = useLanguage();
  const isEn = language === "en";
  const info = useAppTexts();
  const { categories, refresh: refreshMenu } = useMenu();
  const { banners, refresh: refreshBanners } = useBanners();
  const { items: cartItems } = useCartState();

  // qtyMap: parent is the only CartContext subscriber — rows get quantity as prop
  const qtyMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const ci of cartItems) m.set(ci.item.id, ci.quantity);
    return m;
  }, [cartItems]);

  // Stable ref so renderItem stays stable (not in its dep array)
  const qtyMapRef = useRef(qtyMap);
  qtyMapRef.current = qtyMap;

  const [orderMode, setOrderMode] = useState<OrderMode>("delivery");
  const [search, setSearch] = useState("");
  const searchRef = useRef<TextInput>(null);

  useFocusEffect(useCallback(() => { refreshMenu(); }, [refreshMenu]));
  useEffect(() => { refreshBanners(); }, [refreshBanners]);

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h >= 5 && h < 12) return "صباح الخير";
    if (h >= 12 && h < 17) return "مساء الخير";
    return "أهلاً بك";
  }, []);

  const regularCats = useMemo(
    () => categories.filter((c) => !c.isDelivery && !c.isDhabiha && !c.isOccasions),
    [categories]
  );

  const allItems = useMemo(
    () => regularCats.flatMap((c) => c.items),
    [regularCats]
  );

  const favoriteItems = useMemo(
    () => allItems.filter((item) => favorites.includes(item.id)),
    [allItems, favorites]
  );

  // ── Build virtualized flat list ────────────────────────────────────────
  // Search mode: just search results (no section headers)
  // Normal mode: fav section + all categories — virtualized
  const listData = useMemo<ListEntry[]>(() => {
    const q = search.trim();
    if (q.length > 0) {
      const results = allItems.filter(
        (item) =>
          item.name.includes(q) ||
          (item.nameEn ?? "").toLowerCase().includes(q.toLowerCase()) ||
          (item.description ?? "").includes(q)
      );
      return results.map((item) => ({ _t: "searchResult", item }));
    }

    const data: ListEntry[] = [];
    if (favoriteItems.length > 0) {
      data.push({ _t: "favHeader" });
      for (const item of favoriteItems) data.push({ _t: "item", item });
    }
    for (const cat of regularCats) {
      if (cat.items.length === 0) continue;
      data.push({ _t: "catHeader", name: isEn ? (cat.nameEn ?? cat.name) : cat.name, icon: cat.icon, count: cat.items.length });
      for (const item of cat.items) data.push({ _t: "item", item });
    }
    return data;
  }, [search, allItems, favoriteItems, regularCats, isEn]);

  // ── Stable banner header ───────────────────────────────────────────────
  const activeBanners = useMemo(() => banners.filter((b) => b.active), [banners]);
  const renderHeader = useCallback(() => {
    if (activeBanners.length === 0) return null;
    return (
      <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
        <BannerCarousel banners={activeBanners} />
      </View>
    );
  }, [activeBanners]);

  // ── renderItem: stable — reads qtyMapRef, no cart subscription per row ─
  const renderItem = useCallback(({ item }: { item: ListEntry }) => {
    if (item._t === "favHeader") {
      return (
        <View style={[styles.sectionHeader, { paddingTop: 18 }]}>
          <Feather name="heart" size={14} color="#C8171A" />
          <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: F.bold }]}>
            المفضلة
          </Text>
        </View>
      );
    }
    if (item._t === "catHeader") {
      return (
        <View style={[styles.sectionHeader, { paddingTop: 18 }]}>
          <Text style={{ fontSize: 18 }}>{item.icon}</Text>
          <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: F.bold }]}>
            {item.name}
          </Text>
          <Text style={[styles.sectionCount, { color: colors.mutedForeground, fontFamily: F.regular }]}>
            {item.count} صنف
          </Text>
        </View>
      );
    }
    // _t === "item" or "searchResult"
    const rowItem = item.item;
    return (
      <HomeItemRow
        item={rowItem}
        quantity={qtyMapRef.current.get(rowItem.id) ?? 0}
        isEn={isEn}
        whatsapp={info.whatsapp}
        isFavoriteFn={isFavoriteFn}
        onToggleFav={toggleFavorite}
      />
    );
  }, [colors, isEn, info.whatsapp, isFavoriteFn, toggleFavorite, qtyMapRef]);

  const keyExtractor = useCallback((item: ListEntry, i: number) => {
    if (item._t === "favHeader") return "fav-header";
    if (item._t === "catHeader") return `cat-${item.name}`;
    return `item-${item.item.id}-${i}`;
  }, []);

  const getItemType = useCallback((item: ListEntry) => item._t, []);

  const locationText = orderMode === "delivery" ? (user?.address ?? "حدد موقعك") : BRANCH_ADDRESS;
  const locationLabel = orderMode === "delivery" ? "التوصيل" : "الاستلام";

  const handleLocationPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (orderMode === "delivery") {
      router.push("/onboarding");
    } else {
      Linking.openURL(BRANCH_MAPS_URL);
    }
  };

  // Empty state for search
  const searchEmpty = search.trim().length > 0 && listData.length === 0;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={colors.isLight ? "dark-content" : "light-content"} backgroundColor={colors.background} />

      {/* ── STICKY HEADER ── */}
      <View style={[styles.header, { paddingTop: insets.top + 8, backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        {/* Row 1: icons left, greeting right */}
        <View style={styles.topRow}>
          <View style={styles.iconsLeft}>
            <TouchableOpacity
              style={[styles.iconBtn, { backgroundColor: colors.card }]}
              onPress={() => searchRef.current?.focus()}
            >
              <Feather name="search" size={17} color={colors.gold} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.iconBtn, { backgroundColor: colors.card }]}
              onPress={() => {}}
            >
              <Feather name="heart" size={17} color={favorites.length > 0 ? "#C8171A" : colors.mutedForeground} />
              {favorites.length > 0 && (
                <View style={[styles.favBadge, { backgroundColor: "#C8171A" }]}>
                  <Text style={styles.favBadgeText}>{favorites.length > 9 ? "9+" : favorites.length}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
          <View style={styles.greetBlock}>
            <Text style={[styles.greetName, { color: colors.foreground, fontFamily: F.extra }]}>
              {user?.name ? `مرحبا، ${user.name}` : "روابي المندي"}
            </Text>
            <Text style={[styles.greetSub, { color: colors.gold, fontFamily: F.regular }]}>
              {greeting} 👋
            </Text>
          </View>
        </View>

        {/* Row 2: Delivery / Pickup toggle */}
        <View style={[styles.toggleWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <TouchableOpacity
            style={[styles.toggleBtn, orderMode === "pickup" && [styles.toggleActive, { backgroundColor: colors.primary }]]}
            onPress={() => { setOrderMode("pickup"); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
            activeOpacity={0.8}
          >
            <Text style={[styles.toggleText, { fontFamily: F.bold, color: orderMode === "pickup" ? "#fff" : colors.mutedForeground }]}>
              استلام من الفرع
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, orderMode === "delivery" && [styles.toggleActive, { backgroundColor: colors.primary }]]}
            onPress={() => { setOrderMode("delivery"); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
            activeOpacity={0.8}
          >
            <Text style={[styles.toggleText, { fontFamily: F.bold, color: orderMode === "delivery" ? "#fff" : colors.mutedForeground }]}>
              توصيل
            </Text>
          </TouchableOpacity>
        </View>

        {/* Row 3: Location card */}
        <TouchableOpacity
          style={[styles.locationCard, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={handleLocationPress}
          activeOpacity={0.8}
        >
          <Feather name="chevron-left" size={18} color={colors.mutedForeground} />
          <View style={styles.locationTextBlock}>
            <Text style={[styles.locationLabel, { color: colors.gold, fontFamily: F.bold }]}>
              {locationLabel}
            </Text>
            <Text style={[styles.locationValue, { color: colors.foreground, fontFamily: F.regular }]} numberOfLines={1}>
              {locationText}
            </Text>
          </View>
          <View style={[styles.locationDot, { backgroundColor: colors.primary }]}>
            <Feather name="map-pin" size={15} color="#fff" />
          </View>
        </TouchableOpacity>

        {/* Row 4: Search bar */}
        <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: search ? colors.gold : colors.border }]}>
          <Feather name="search" size={16} color={colors.mutedForeground} style={{ marginLeft: 10 }} />
          <TextInput
            ref={searchRef}
            value={search}
            onChangeText={setSearch}
            placeholder="ابحث عن صنف..."
            placeholderTextColor={colors.mutedForeground}
            style={[styles.searchInput, { color: colors.foreground, fontFamily: F.regular }]}
            textAlign="right"
            returnKeyType="search"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch("")} style={{ paddingHorizontal: 10 }}>
              <Feather name="x" size={15} color={colors.mutedForeground} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ── EMPTY SEARCH STATE ── */}
      {searchEmpty ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 12 }}>
          <Text style={{ fontSize: 40 }}>🔍</Text>
          <Text style={{ fontFamily: F.regular, fontSize: 14, color: colors.mutedForeground, textAlign: "center" }}>
            لا توجد نتائج لـ "{search}"
          </Text>
        </View>
      ) : (
        /* ── VIRTUALIZED LIST (FlashList) ── */
        <FlashList
          data={listData}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          getItemType={getItemType}
          extraData={qtyMap}
          ListHeaderComponent={renderHeader}
          ListFooterComponent={<View style={{ height: insets.bottom + 100 }} />}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        />
      )}

      <CartBar />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  iconsLeft: {
    flexDirection: "row",
    gap: 8,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  favBadge: {
    position: "absolute",
    top: -2,
    right: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  favBadgeText: {
    color: "#fff",
    fontSize: 9,
    fontFamily: "Cairo_700Bold",
  },
  greetBlock: {
    alignItems: "flex-end",
    gap: 1,
  },
  greetName: { fontSize: 17 },
  greetSub: { fontSize: 13 },
  toggleWrap: {
    flexDirection: "row",
    borderRadius: 30,
    borderWidth: 1,
    overflow: "hidden",
    height: 48,
  },
  toggleBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 28,
    margin: 3,
  },
  toggleActive: {
    shadowColor: "#C8171A",
    shadowOpacity: 0.3,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  toggleText: { fontSize: 15 },
  locationCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 14,
    gap: 10,
  },
  locationTextBlock: {
    flex: 1,
    alignItems: "flex-end",
    gap: 2,
  },
  locationLabel: { fontSize: 12 },
  locationValue: { fontSize: 14, textAlign: "right" },
  locationDot: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    height: 44,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 0,
    paddingHorizontal: 8,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 6,
    paddingHorizontal: 16,
    paddingBottom: 4,
  },
  sectionTitle: { fontSize: 16 },
  sectionCount: {
    fontSize: 12,
    marginRight: "auto",
  },
});
