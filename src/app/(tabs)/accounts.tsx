import React, { useEffect, useState, useCallback, useMemo } from "react";
import { View, Text, ScrollView, RefreshControl, ActivityIndicator, TouchableOpacity, Alert, DeviceEventEmitter, Image } from "react-native";
import { getSupabase } from "../../../lib/supabase";
import { Wallet, Landmark, CreditCard, Smartphone, TrendingUp, PiggyBank, Plus, ArchiveX, Edit2, Trash2, ChevronUp, ChevronDown, ArrowUpDown, X, Check, GripVertical } from "lucide-react-native";
import DraggableFlatList, { ScaleDecorator } from "react-native-draggable-flatlist";
import { useSession } from "../_layout";
import { useTheme } from "../../theme/ThemeProvider";
import { GlassCard } from "../../components/ui/GlassCard";
import { AccountsSkeleton } from "../../components/ui/Skeletons";
import { AddAccountModal, AccountData } from "../../components/accounts/AddAccountModal";
import { AddTransactionModal } from "../../components/transactions/AddTransactionModal";
import { AnimatedListItem } from "../../components/ui/AnimatedListItem";
import { EVENTS } from "../../lib/events";
import { Swipeable } from "react-native-gesture-handler";
import * as Haptics from "expo-haptics";
import { useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { formatCurrency } from "../../lib/utils";

const WALLET_LOGOS: Record<string, any> = {
  'GCash': require('../../../assets/images/logos/gcash.png'),
  'Maya Savings': require('../../../assets/images/logos/maya.png'),
  'Maya': require('../../../assets/images/logos/maya.png'),
  'GoTyme Savings': require('../../../assets/images/logos/gotyme.png'),
  'GoTyme': require('../../../assets/images/logos/gotyme.png'),
  'SeaBank Savings': require('../../../assets/images/logos/seabank.png'),
  'SeaBank': require('../../../assets/images/logos/seabank.png'),
  'SPayLater': require('../../../assets/images/logos/Spaylater.png'),
  'Metrobank': require('../../../assets/images/logos/Metrobank.webp'),
};

const getAccountIcon = (type: string, color: string, name?: string) => {
  if (name && WALLET_LOGOS[name]) {
    return <Image source={WALLET_LOGOS[name]} style={{ width: 24, height: 24, borderRadius: 12 }} resizeMode="contain" />;
  }
  switch (type) {
    case "cash": return <Wallet color={color} size={24} />;
    case "bank": return <Landmark color={color} size={24} />;
    case "credit_card": return <CreditCard color={color} size={24} />;
    case "e_wallet": return <Smartphone color={color} size={24} />;
    case "investment": return <TrendingUp color={color} size={24} />;
    default: return <PiggyBank color={color} size={24} />;
  }
};

const getAccountTypeLabel = (type: string) => {
  switch (type) {
    case "cash": return "Cash";
    case "bank": return "Bank Account";
    case "credit_card": return "PayLater / Debt";
    case "e_wallet": return "E-Wallet";
    case "investment": return "Investment";
    default: return "Other";
  }
};

export default function WalletsScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [accounts, setAccounts] = useState<any[]>([]);
  const { user } = useSession();

  const [modalVisible, setModalVisible] = useState(false);
  const [editingAccount, setEditingAccount] = useState<AccountData | null>(null);
  const [transactionModalVisible, setTransactionModalVisible] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [previewAfterPay, setPreviewAfterPay] = useState(false);
  const [debtByMonth, setDebtByMonth] = useState<Record<string, number>>({});
  const [selectedDebtMonths, setSelectedDebtMonths] = useState<string[]>([]);
  const [isDebtLoading, setIsDebtLoading] = useState(false);
  const [isEditingOrder, setIsEditingOrder] = useState(false);



  const saveAccountOrder = async () => {
    if (!user) return;
    try {
      const updates = accounts.map((acc, idx) =>
        getSupabase()
          .from("accounts")
          .update({ display_order: idx })
          .eq("id", acc.id)
          .eq("user_id", user.id)
      );

      await Promise.all(updates);
      setIsEditingOrder(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      Alert.alert("Error", "Failed to save wallet order.");
    }
  };

  const totalMoneyRaw = accounts
    .filter(a => a.type !== 'credit_card' && a.include_in_networth !== false)
    .reduce((sum, a) => sum + Number(a.balance || 0), 0);

  const sortedMonths = Object.keys(debtByMonth)
    .filter(m => Number((debtByMonth[m] || 0).toFixed(2)) >= 0.01)
    .sort((a, b) => (a < b ? -1 : 1));

  const isAllMonthsSelected = selectedDebtMonths.length === sortedMonths.length || selectedDebtMonths.length === 0;

  const selectedDebt = useMemo(() => {
    const months = isAllMonthsSelected ? sortedMonths : selectedDebtMonths;
    return months.reduce((sum, m) => sum + Math.max(0, Number(debtByMonth[m] || 0)), 0);
  }, [debtByMonth, isAllMonthsSelected, selectedDebtMonths, sortedMonths]);

  const totalBalance = previewAfterPay ? totalMoneyRaw - selectedDebt : totalMoneyRaw;
  const totalDebt = selectedDebt;

  const loadAccounts = async () => {
    try {
      if (!user) return;

      const { data, error } = await getSupabase()
        .from("accounts")
        .select("*")
        .eq("user_id", user.id)
        .order("display_order", { ascending: true })
        .order("created_at", { ascending: true });

      let finalData = data;
      if (error) {
        const { data: fallbackData } = await getSupabase()
          .from("accounts")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: true });
        finalData = fallbackData;
      }

      if (finalData) {
        let accountsList = [...finalData];
        const creditIds = accountsList.filter((a: any) => a.type === "credit_card").map((a: any) => a.id);
        
        if (creditIds.length > 0) {
          setIsDebtLoading(true);
          const { data: txData, error: txErr } = await getSupabase()
            .from("transactions")
            .select("id, account_id, type, amount, date, transfer_to_account_id")
            .eq("user_id", user.id)
            .or(`account_id.in.(${creditIds.join(",")}),transfer_to_account_id.in.(${creditIds.join(",")})`)
            .order("date", { ascending: false })
            .limit(5000);

          if (!txErr && txData) {
            const byMonth: Record<string, number> = {};
            const byCreditAccount: Record<string, number> = {};
            creditIds.forEach((id: string) => {
              byCreditAccount[id] = 0;
            });

            txData.forEach((t: any) => {
              const monthKey = typeof t?.date === "string" ? t.date.slice(0, 7) : "unknown";
              if (!byMonth[monthKey]) byMonth[monthKey] = 0;

              const amt = Number(t?.amount || 0);
              const isCreditSource = creditIds.includes(t?.account_id);
              const isCreditDestination = creditIds.includes(t?.transfer_to_account_id);

              if (t.type === "expense" && isCreditSource) {
                byMonth[monthKey] += amt;
                byCreditAccount[t.account_id] = Number(byCreditAccount[t.account_id] || 0) + amt;
              } else if (t.type === "income" && isCreditSource) {
                byMonth[monthKey] -= amt;
                byCreditAccount[t.account_id] = Number(byCreditAccount[t.account_id] || 0) - amt;
              } else if (t.type === "transfer") {
                if (isCreditDestination) byMonth[monthKey] -= amt;
                if (isCreditSource) byMonth[monthKey] += amt;
                if (isCreditDestination) {
                  byCreditAccount[t.transfer_to_account_id] = Number(byCreditAccount[t.transfer_to_account_id] || 0) - amt;
                }
                if (isCreditSource) {
                  byCreditAccount[t.account_id] = Number(byCreditAccount[t.account_id] || 0) + amt;
                }
              }
            });

            const normalizedByMonth: Record<string, number> = {};
            const ascMonths = Object.keys(byMonth)
              .filter((k) => k && k !== "unknown")
              .sort((a, b) => (a < b ? -1 : 1));
            let carry = 0;
            for (const m of ascMonths) {
              const raw = Number(byMonth[m] || 0);
              const next = Number((raw + carry).toFixed(2));
              if (next < 0) {
                normalizedByMonth[m] = 0;
                carry = next;
              } else {
                normalizedByMonth[m] = next;
                carry = 0;
              }
            }

            setDebtByMonth(normalizedByMonth);

            const nextCreditBalanceById: Record<string, number> = {};
            creditIds.forEach((id: string) => {
              nextCreditBalanceById[id] = Math.max(0, Number(byCreditAccount[id] || 0));
            });

            const creditUpdates = accountsList
              .filter((a: any) => a?.type === "credit_card" && a?.id)
              .map((a: any) => {
                const nextBal = Number(nextCreditBalanceById[a.id] || 0);
                const currentBal = Number(a?.balance || 0);
                return { id: a.id, currentBal, nextBal };
              })
              .filter((u: any) => Math.abs(u.nextBal - u.currentBal) > 0.005);

            if (creditUpdates.length > 0) {
              await Promise.all(
                creditUpdates.map((u: any) =>
                  getSupabase()
                    .from("accounts")
                    .update({ balance: u.nextBal })
                    .eq("id", u.id)
                    .eq("user_id", user.id)
                )
              );
              
              accountsList = accountsList.map((a: any) =>
                a?.type === "credit_card" && a?.id
                  ? { ...a, balance: Number(nextCreditBalanceById[a.id] || 0) }
                  : a
              );
            }
          }
        }
        setAccounts(accountsList);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
      setIsDebtLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadAccounts();
    }, [user])
  );

  useEffect(() => {
    const sub1 = DeviceEventEmitter.addListener(EVENTS.ACCOUNT_ADDED, loadAccounts);
    const sub2 = DeviceEventEmitter.addListener(EVENTS.ACCOUNT_UPDATED, loadAccounts);
    const sub3 = DeviceEventEmitter.addListener(EVENTS.TRANSACTION_ADDED, loadAccounts);
    return () => {
      sub1.remove();
      sub2.remove();
      sub3.remove();
    };
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadAccounts();
  };

  const handleAddAccount = () => {
    setEditingAccount(null);
    setModalVisible(true);
  };

  const handleEditAccount = (account: any) => {
    setEditingAccount({
      id: account.id,
      name: account.name,
      type: account.type,
      balance: account.balance
    });
    setModalVisible(true);
  };

  const handleTransact = (accountId: string) => {
    setSelectedAccountId(accountId);
    setTransactionModalVisible(true);
  };

  const handleDelete = (accountId: string) => {
    Alert.alert(
      "Delete Account",
      "Are you sure you want to delete this account? All associated transactions will be deleted too.",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete", 
          style: "destructive",
          onPress: async () => {
            try {
              const { error } = await getSupabase()
                .from('accounts')
                .delete()
                .eq('id', accountId)
                .eq('user_id', user!.id);
              
              if (error) throw error;
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              DeviceEventEmitter.emit(EVENTS.ACCOUNT_UPDATED);
            } catch (err) {
              Alert.alert("Error", "Failed to delete account.");
            }
          }
        }
      ]
    );
  };

  const renderRightActions = (accountId: string) => {
    return (
      <TouchableOpacity 
        style={{ backgroundColor: '#ef4444', justifyContent: 'center', alignItems: 'center', width: 80, height: '100%', borderTopRightRadius: 24, borderBottomRightRadius: 24 }}
        onPress={() => handleDelete(accountId)}
      >
        <Trash2 color="#fff" size={24} />
      </TouchableOpacity>
    );
  };

  const renderItem = ({ item: account, drag, isActive }: any) => {
    const isDebt = account.type === "credit_card";
    const balance = Number(account.balance || 0);

    return (
      <ScaleDecorator>
        <AnimatedListItem key={account.id} delay={0}>
          <Swipeable enabled={!isEditingOrder} renderRightActions={() => renderRightActions(account.id)} overshootRight={false}>
            <TouchableOpacity 
              activeOpacity={0.8} 
              onPress={() => handleTransact(account.id)} 
              onLongPress={isEditingOrder ? drag : undefined}
              disabled={isEditingOrder && !isActive}
              style={{ paddingHorizontal: 24, marginBottom: 16 }}
            >
              <GlassCard style={{ padding: 20, borderWidth: isActive ? 2 : 0, borderColor: colors.primary }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                    <View style={{ backgroundColor: 'rgba(34, 197, 94, 0.1)', padding: 12, borderRadius: 999, marginRight: 16 }}>
                      {getAccountIcon(account.type, colors.primary, account.name)}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontFamily: 'BricolageGrotesque_700Bold', color: colors.text, fontSize: 18, marginBottom: 4 }}>{account.name}</Text>
                      <Text style={{ fontFamily: 'Manrope_500Medium', color: colors.textMuted, fontSize: 14 }}>{getAccountTypeLabel(account.type)}</Text>
                    </View>
                  </View>
                  {isEditingOrder ? (
                    <TouchableOpacity 
                      onPressIn={drag} 
                      style={{ padding: 8, marginRight: -4 }}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <GripVertical color={colors.textMuted} size={20} />
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity 
                      onPress={() => handleEditAccount(account)} 
                      style={{ padding: 8, marginRight: -4 }}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Edit2 color={colors.textMuted} size={18} />
                    </TouchableOpacity>
                  )}
                </View>

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 16 }}>
                  <Text style={{ fontFamily: 'Manrope_500Medium', color: colors.textMuted }}>Balance</Text>
                  <Text style={{ 
                    fontFamily: 'BricolageGrotesque_700Bold', 
                    fontSize: 24, 
                    color: isDebt && balance > 0 ? "#ef4444" : colors.text 
                  }}>
                    {isDebt && balance > 0 ? "-" : ""}{formatCurrency(balance)}
                  </Text>
                </View>
              </GlassCard>
            </TouchableOpacity>
          </Swipeable>
        </AnimatedListItem>
      </ScaleDecorator>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <DraggableFlatList
        data={accounts}
        onDragEnd={({ data }) => {
          setAccounts(data);
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        ListHeaderComponent={
          <View style={{ padding: 24, paddingTop: 64, paddingBottom: 8 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: 'BricolageGrotesque_700Bold', fontSize: 30, color: colors.text }}>
                  {isEditingOrder ? 'Reorder' : 'Wallets'}
                </Text>
                <Text style={{ fontFamily: 'Manrope_400Regular', color: colors.textMuted, marginTop: 4 }}>
                  {isEditingOrder ? 'Drag cards to adjust the order of your wallets' : 'Your wallets and balances'}
                </Text>
              </View>
              {isEditingOrder ? (
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity 
                    onPress={() => {
                      setIsEditingOrder(false);
                      loadAccounts(); // reload original order
                    }} 
                    style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: 12, borderRadius: 999 }}
                  >
                    <X color="#ef4444" size={24} />
                  </TouchableOpacity>
                  <TouchableOpacity 
                    onPress={saveAccountOrder} 
                    style={{ backgroundColor: colors.primary, padding: 12, borderRadius: 999 }}
                  >
                    <Check color="#fff" size={24} />
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {accounts.length > 1 && (
                    <TouchableOpacity 
                      onPress={() => setIsEditingOrder(true)} 
                      style={{ borderWidth: 1, borderColor: colors.border, padding: 12, borderRadius: 999 }}
                    >
                      <ArrowUpDown color={colors.text} size={24} />
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity onPress={handleAddAccount} style={{ backgroundColor: colors.primary, padding: 12, borderRadius: 999 }}>
                    <Plus color="#fff" size={24} />
                  </TouchableOpacity>
                </View>
              )}
            </View>

            <GlassCard style={{ padding: 20, marginBottom: 8, gap: 16 }}>
              <View>
                <Text style={{ fontFamily: 'Manrope_500Medium', color: colors.textMuted }}>Current Total Balance</Text>
                <Text style={{ fontFamily: 'BricolageGrotesque_700Bold', fontSize: 32, color: colors.primary }}>
                  {formatCurrency(totalBalance)}
                </Text>
                <Text style={{ fontFamily: 'Manrope_400Regular', color: colors.textMuted, fontSize: 13, marginTop: 4 }}>
                  Excluding credit card / debt accounts
                </Text>
              </View>

              <View style={{ backgroundColor: 'rgba(255, 255, 255, 0.03)', padding: 16, borderRadius: 16, gap: 12 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontFamily: 'Manrope_500Medium', color: colors.textMuted, fontSize: 14 }}>
                    {isAllMonthsSelected ? 'Debt balance (All)' : 'Debt balance (Selected)'}
                  </Text>
                  <Text style={{ fontFamily: 'BricolageGrotesque_700Bold', color: '#ef4444', fontSize: 16 }}>
                    {isDebtLoading ? "Loading..." : `-${formatCurrency(totalDebt)}`}
                  </Text>
                </View>

                <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center', marginTop: 4 }}>
                  <TouchableOpacity 
                    onPress={() => setPreviewAfterPay(!previewAfterPay)}
                    disabled={isDebtLoading}
                    style={{ 
                      backgroundColor: previewAfterPay ? colors.primary : 'transparent',
                      borderWidth: previewAfterPay ? 0 : 1,
                      borderColor: colors.primary,
                      paddingVertical: 8,
                      paddingHorizontal: 16,
                      borderRadius: 999,
                      alignSelf: 'flex-start'
                    }}
                  >
                    <Text style={{ 
                      fontFamily: 'Manrope_500Medium', 
                      color: previewAfterPay ? '#fff' : colors.primary,
                      fontSize: 14 
                    }}>
                      {previewAfterPay ? "Preview: after paying" : "Preview: off"}
                    </Text>
                  </TouchableOpacity>
                </View>

                {sortedMonths.length > 0 && (
                  <View style={{ marginTop: 8 }}>
                    <Text style={{ fontFamily: 'Manrope_500Medium', color: colors.textMuted, fontSize: 12, marginBottom: 8 }}>
                      Select debt months to preview paying:
                    </Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row' }}>
                      <TouchableOpacity 
                        onPress={() => {
                          if (isAllMonthsSelected) {
                            setSelectedDebtMonths(sortedMonths.length > 0 ? [sortedMonths[0]] : []);
                          } else {
                            setSelectedDebtMonths(sortedMonths);
                          }
                        }}
                        style={{ 
                          backgroundColor: isAllMonthsSelected ? colors.primary : 'transparent',
                          borderColor: colors.border,
                          borderWidth: isAllMonthsSelected ? 0 : 1,
                          paddingVertical: 6,
                          paddingHorizontal: 12,
                          borderRadius: 999,
                          marginRight: 8,
                          justifyContent: 'center'
                        }}
                      >
                        <Text style={{ color: isAllMonthsSelected ? '#fff' : colors.text, fontSize: 12, fontFamily: 'Manrope_500Medium' }}>
                          All months
                        </Text>
                      </TouchableOpacity>

                      {sortedMonths.map((m) => {
                        const isSelected = selectedDebtMonths.includes(m);
                        const isHighlighted = isSelected && !isAllMonthsSelected;
                        const monthVal = Math.max(0, Number(debtByMonth[m] || 0));
                        return (
                          <TouchableOpacity 
                            key={m}
                            onPress={() => {
                              setSelectedDebtMonths((prev) => {
                                const prevSet = new Set(prev.length > 0 ? prev : sortedMonths);
                                if (isSelected) {
                                  prevSet.delete(m);
                                } else {
                                  prevSet.add(m);
                                }
                                
                                if (prevSet.size === 0) return sortedMonths;
                                if (prevSet.size === sortedMonths.length) return sortedMonths;
                                return sortedMonths.filter(x => prevSet.has(x));
                              });
                            }}
                            style={{ 
                              backgroundColor: isHighlighted ? colors.primary : 'transparent',
                              borderColor: colors.border,
                              borderWidth: isHighlighted ? 0 : 1,
                              paddingVertical: 6,
                              paddingHorizontal: 12,
                              borderRadius: 999,
                              marginRight: 8,
                              justifyContent: 'center'
                            }}
                          >
                            <Text style={{ color: isHighlighted ? '#fff' : colors.text, fontSize: 12, fontFamily: 'Manrope_500Medium' }}>
                              {m} ({formatCurrency(monthVal)})
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </View>
                )}
              </View>
            </GlassCard>
          </View>
        }
        ListEmptyComponent={
          <View style={{ paddingVertical: 48, alignItems: 'center', justifyContent: 'center' }}>
            <Wallet color={colors.border} size={48} />
            <Text style={{ fontFamily: 'Manrope_500Medium', color: colors.textMuted, marginTop: 16, textAlign: 'center' }}>No active accounts found.</Text>
          </View>
        }
        renderItem={renderItem}
      />

      <AddAccountModal 
        visible={modalVisible} 
        onClose={() => setModalVisible(false)} 
        initialData={editingAccount}
        existingAccounts={accounts}
      />

      <AddTransactionModal
        visible={transactionModalVisible}
        onClose={() => setTransactionModalVisible(false)}
        initialAccountId={selectedAccountId}
      />
    </View>
  );
}
