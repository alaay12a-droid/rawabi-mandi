import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
  StatusBar,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useUser } from "@/context/UserContext";
import { useTranslation } from "@/hooks/useTranslation";
import { apiGet } from "@/constants/api";

const F = {
  regular: "Cairo_400Regular",
  semi: "Cairo_600SemiBold",
  bold: "Cairo_700Bold",
  extra: "Cairo_800ExtraBold",
};

type TxType = "deposit" | "withdrawal" | "expiry";
type FilterTab = "all" | TxType;

interface WalletData {
  phone: string;
  balance: number;
}

interface Transaction {
  id: number;
  phone: string;
  type: TxType;
  amount: number;
  balanceAfter: number;
  note: string | null;
  orderId: number | null;
  createdAt: string;
}

function formatDate(iso: string, lang: string) {
  const d = new Date(iso);
  return d.toLocaleDateString(lang === "ar" ? "ar-SA" : "en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function WalletScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useUser();
  const { t, language } = useTranslation();
  const topInset = Platform.OS === "web" ? 20 : insets.top;

  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!user?.phone) return;
    try {
      const [w, txs] = await Promise.all([
        apiGet<WalletData>(`/wallet?phone=${encodeURIComponent(user.phone)}`),
        apiGet<Transaction[]>(`/wallet/transactions?phone=${encodeURIComponent(user.phone)}`),
      ]);
      setWallet(w);
      setTransactions(txs);
    } catch {}
    finally { setLoading(false); }
  }, [user?.phone]);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const filtered = activeTab === "all"
    ? transactions
    : transactions.filter((tx) => tx.type === activeTab);

  const TABS: { key: FilterTab; label: string }[] = [
    { key: "all", label: t("all") },
    { key: "deposit", label: t("deposit") },
    { key: "withdrawal", label: t("withdrawal") },
    { key: "expiry", label: t("expiry") },
  ];

  const TX_COLOR: Record<TxType, string> = {
    deposit: "#22C55E",
    withdrawal: "#E53935",
    expiry: "#9A7A5A",
  };

  const TX_ICON: Record<TxType, string> = {
    deposit: "arrow-down-circle",
    withdrawal: "arrow-up-circle",
    expiry: "clock",
  };

  const isRTL = language === "ar";

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="light-content" />

      <View style={[styles.header, { backgroundColor: colors.card, paddingTop: topInset + 8, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={[styles.backBtn, { backgroundColor: colors.secondary }]}
        >
          <Feather name={isRTL ? "arrow-right" : "arrow-left"} size={20} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground, fontFamily: F.bold }]}>
          {t("wallet")}
        </Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.gold} colors={[colors.gold]} />}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {/* Balance Card */}
        <View style={[styles.balanceCard, { backgroundColor: "#2A1A0A", borderColor: colors.gold + "40" }]}>
          <View style={[styles.walletIconWrap, { backgroundColor: colors.gold + "22" }]}>
            <Feather name="credit-card" size={28} color={colors.gold} />
          </View>
          <Text style={[styles.balanceLabel, { color: colors.mutedForeground, fontFamily: F.semi }]}>
            {t("balance")}
          </Text>
          {loading ? (
            <ActivityIndicator color={colors.gold} style={{ marginTop: 8 }} />
          ) : (
            <View style={styles.balanceRow}>
              <Text style={[styles.balanceCurrency, { color: colors.mutedForeground, fontFamily: F.semi }]}>
                {t("sar")}
              </Text>
              <Text style={[styles.balanceAmount, { color: colors.gold, fontFamily: F.extra }]}>
                {wallet?.balance ?? 0}
              </Text>
            </View>
          )}
          <Text style={[styles.walletDesc, { color: colors.mutedForeground, fontFamily: F.regular }]}>
            {t("walletDesc")}
          </Text>
        </View>

        {/* Filter Tabs */}
        <View style={[styles.tabsRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {TABS.map((tab) => (
            <TouchableOpacity
              key={tab.key}
              onPress={() => setActiveTab(tab.key)}
              style={[
                styles.tab,
                activeTab === tab.key && { borderBottomColor: colors.gold, borderBottomWidth: 2 },
              ]}
            >
              <Text style={[
                styles.tabText,
                { fontFamily: F.bold, color: activeTab === tab.key ? colors.gold : colors.mutedForeground, fontSize: 13 },
              ]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Transactions */}
        <View style={{ paddingHorizontal: 16, paddingTop: 12, gap: 10 }}>
          {loading ? (
            <ActivityIndicator color={colors.gold} style={{ marginTop: 32 }} />
          ) : filtered.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Feather name="inbox" size={40} color={colors.border} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground, fontFamily: F.semi }]}>
                {t("noTransactions")}
              </Text>
            </View>
          ) : (
            filtered.map((tx) => (
              <View key={tx.id} style={[styles.txCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={[styles.txIconWrap, { backgroundColor: TX_COLOR[tx.type] + "22" }]}>
                  <Feather name={TX_ICON[tx.type] as any} size={20} color={TX_COLOR[tx.type]} />
                </View>
                <View style={{ flex: 1, alignItems: isRTL ? "flex-end" : "flex-start" }}>
                  <Text style={[styles.txNote, { color: colors.foreground, fontFamily: F.bold }]}>
                    {tx.note || (tx.type === "deposit" ? t("deposit") : tx.type === "withdrawal" ? t("withdrawal") : t("expiry"))}
                  </Text>
                  <Text style={[styles.txDate, { color: colors.mutedForeground, fontFamily: F.regular }]}>
                    {formatDate(tx.createdAt, language)}
                  </Text>
                </View>
                <Text style={[styles.txAmount, { color: TX_COLOR[tx.type], fontFamily: F.extra }]}>
                  {tx.amount > 0 ? "+" : ""}{tx.amount} {t("sar")}
                </Text>
              </View>
            ))
          )}
        </View>

        {/* Balance at bottom like the reference app */}
        {!loading && (
          <View style={[styles.bottomBalance, { borderTopColor: colors.border }]}>
            <Text style={[styles.bottomBalanceText, { color: colors.foreground, fontFamily: F.bold }]}>
              {t("balance")} {wallet?.balance ?? 0} {t("sar")}
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 18 },
  balanceCard: {
    margin: 16,
    borderRadius: 20,
    borderWidth: 1,
    padding: 24,
    alignItems: "center",
    gap: 8,
  },
  walletIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  balanceLabel: { fontSize: 14 },
  balanceRow: { flexDirection: "row", alignItems: "flex-end", gap: 6 },
  balanceAmount: { fontSize: 48 },
  balanceCurrency: { fontSize: 18, marginBottom: 8 },
  walletDesc: { fontSize: 13, textAlign: "center", marginTop: 4 },
  tabsRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderTopWidth: 1,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabText: {},
  emptyWrap: { alignItems: "center", gap: 12, paddingTop: 48 },
  emptyText: { fontSize: 15 },
  txCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  txIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  txNote: { fontSize: 14 },
  txDate: { fontSize: 12, marginTop: 2 },
  txAmount: { fontSize: 16 },
  bottomBalance: {
    marginTop: 24,
    borderTopWidth: 1,
    paddingTop: 16,
    paddingHorizontal: 20,
    alignItems: "flex-end",
  },
  bottomBalanceText: { fontSize: 16 },
});
