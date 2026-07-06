import React, { useEffect, useState, useCallback } from "react";
import { View, Text, ScrollView, RefreshControl, ActivityIndicator, TouchableOpacity, Alert, DeviceEventEmitter, Image } from "react-native";
import { getSupabase } from "../../../lib/supabase";
import { Wallet, Landmark, CreditCard, Smartphone, TrendingUp, PiggyBank, Plus, ArchiveX, Edit2, Trash2 } from "lucide-react-native";
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
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [accounts, setAccounts] = useState<any[]>([]);
  const { user } = useSession();

  const [modalVisible, setModalVisible] = useState(false);
  const [editingAccount, setEditingAccount] = useState<AccountData | null>(null);
  const [transactionModalVisible, setTransactionModalVisible] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [previewAfterPay, setPreviewAfterPay] = useState(false);

  const totalMoneyRaw = accounts
    .filter(a => a.type !== 'credit_card' && a.include_in_networth !== false)
    .reduce((sum, a) => sum + Number(a.balance || 0), 0);
  const totalDebtRaw = accounts
    .filter(a => a.type === 'credit_card' && a.include_in_networth !== false)
    .reduce((sum, a) => sum + Math.max(0, Number(a.balance || 0)), 0);

  const totalBalance = previewAfterPay ? totalMoneyRaw - totalDebtRaw : totalMoneyRaw;
  const totalDebt = totalDebtRaw;

  const loadAccounts = async () => {
    try {
      if (!user) return;

      const { data } = await getSupabase()
        .from("accounts")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true });

      if (data) {
        setAccounts(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
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

  if (isLoading) {
    return <AccountsSkeleton />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView 
        style={{ flex: 1 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        <View style={{ padding: 24, paddingTop: 64 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
            <View>
              <Text style={{ fontFamily: 'BricolageGrotesque_700Bold', fontSize: 30, color: colors.text }}>Wallets</Text>
              <Text style={{ fontFamily: 'Manrope_400Regular', color: colors.textMuted, marginTop: 4 }}>Your wallets and balances</Text>
            </View>
            <TouchableOpacity onPress={handleAddAccount} style={{ backgroundColor: colors.primary, padding: 12, borderRadius: 999 }}>
              <Plus color="#fff" size={24} />
            </TouchableOpacity>
          </View>

          <GlassCard style={{ padding: 20, marginBottom: 24, gap: 16 }}>
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
                <Text style={{ fontFamily: 'Manrope_500Medium', color: colors.textMuted, fontSize: 14 }}>Debt balance</Text>
                <Text style={{ fontFamily: 'BricolageGrotesque_700Bold', color: '#ef4444', fontSize: 16 }}>
                  -{formatCurrency(totalDebt)}
                </Text>
              </View>

              <TouchableOpacity 
                onPress={() => setPreviewAfterPay(!previewAfterPay)}
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
          </GlassCard>

          <View style={{ gap: 16 }}>
            {accounts.map((account, idx) => {
              const isDebt = account.type === "credit_card";
              const balance = Number(account.balance || 0);

              return (
                <AnimatedListItem key={account.id} delay={idx * 80}>
                  <Swipeable renderRightActions={() => renderRightActions(account.id)} overshootRight={false}>
                  <TouchableOpacity activeOpacity={0.8} onPress={() => handleTransact(account.id)}>
                    <GlassCard style={{ padding: 20 }}>
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
                        <TouchableOpacity 
                          onPress={() => handleEditAccount(account)} 
                          style={{ padding: 8, marginRight: -4 }}
                          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                          <Edit2 color={colors.textMuted} size={18} />
                        </TouchableOpacity>
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
              );
            })}

            {accounts.length === 0 && (
              <View style={{ paddingVertical: 48, alignItems: 'center', justifyContent: 'center' }}>
                <Wallet color={colors.border} size={48} />
                <Text style={{ fontFamily: 'Manrope_500Medium', color: colors.textMuted, marginTop: 16, textAlign: 'center' }}>No active accounts found.</Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      <AddAccountModal 
        visible={modalVisible} 
        onClose={() => setModalVisible(false)} 
        initialData={editingAccount}
      />

      <AddTransactionModal
        visible={transactionModalVisible}
        onClose={() => setTransactionModalVisible(false)}
        initialAccountId={selectedAccountId}
      />
    </View>
  );
}
