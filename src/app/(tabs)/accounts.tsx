import React, { useEffect, useState, useCallback } from "react";
import { View, Text, ScrollView, RefreshControl, ActivityIndicator, TouchableOpacity, Alert, DeviceEventEmitter } from "react-native";
import { getSupabase } from "../../../lib/supabase";
import { Wallet, Landmark, CreditCard, Building2, TrendingUp, PiggyBank, Plus, ArchiveX } from "lucide-react-native";
import { useSession } from "../_layout";
import { useTheme } from "../../theme/ThemeProvider";
import { GlassCard } from "../../components/ui/GlassCard";
import { AddAccountModal, AccountData } from "../../components/accounts/AddAccountModal";
import { EVENTS } from "../../lib/events";
import { Swipeable } from "react-native-gesture-handler";
import * as Haptics from "expo-haptics";
import { useFocusEffect } from "expo-router";

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(amount);
};

const getAccountIcon = (type: string, color: string) => {
  switch (type) {
    case "cash": return <Wallet color={color} size={24} />;
    case "bank": return <Landmark color={color} size={24} />;
    case "credit_card": return <CreditCard color={color} size={24} />;
    case "e_wallet": return <Building2 color={color} size={24} />;
    case "investment": return <TrendingUp color={color} size={24} />;
    default: return <PiggyBank color={color} size={24} />;
  }
};

const getAccountTypeLabel = (type: string) => {
  switch (type) {
    case "cash": return "Cash";
    case "bank": return "Bank Account";
    case "credit_card": return "Credit Card";
    case "e_wallet": return "E-Wallet";
    case "investment": return "Investment";
    default: return "Other";
  }
};

export default function AccountsScreen() {
  const { colors } = useTheme();
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [accounts, setAccounts] = useState<any[]>([]);
  const { user } = useSession();

  const [modalVisible, setModalVisible] = useState(false);
  const [editingAccount, setEditingAccount] = useState<AccountData | null>(null);

  const loadAccounts = async () => {
    try {
      if (!user) return;

      const { data } = await getSupabase()
        .from("accounts")
        .select("*")
        .eq("user_id", user.id)
        .neq("include_in_networth", false) // Filter out archived accounts
        .order("display_order", { ascending: true })
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

  const handleArchive = (accountId: string) => {
    Alert.alert(
      "Archive Account",
      "Are you sure you want to archive this account? It will be hidden from your balances, but historical transactions remain intact.",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Archive", 
          style: "destructive",
          onPress: async () => {
            try {
              const { error } = await getSupabase()
                .from('accounts')
                .update({ include_in_networth: false })
                .eq('id', accountId)
                .eq('user_id', user!.id);
              
              if (error) throw error;
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              DeviceEventEmitter.emit(EVENTS.ACCOUNT_UPDATED);
            } catch (err) {
              Alert.alert("Error", "Failed to archive account.");
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
        onPress={() => handleArchive(accountId)}
      >
        <ArchiveX color="#fff" size={24} />
      </TouchableOpacity>
    );
  };

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
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
              <Text style={{ fontFamily: 'BricolageGrotesque_700Bold', fontSize: 30, color: colors.text }}>Accounts</Text>
              <Text style={{ fontFamily: 'Manrope_400Regular', color: colors.textMuted, marginTop: 4 }}>Your wallets and balances</Text>
            </View>
            <TouchableOpacity onPress={handleAddAccount} style={{ backgroundColor: colors.primary, padding: 12, borderRadius: 999 }}>
              <Plus color="#fff" size={24} />
            </TouchableOpacity>
          </View>

          <View style={{ gap: 16 }}>
            {accounts.map((account) => {
              const isDebt = account.type === "credit_card";
              const balance = Number(account.balance || 0);

              return (
                <Swipeable key={account.id} renderRightActions={() => renderRightActions(account.id)} overshootRight={false}>
                  <TouchableOpacity activeOpacity={0.8} onPress={() => handleEditAccount(account)}>
                    <GlassCard style={{ padding: 20 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                          <View style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', padding: 12, borderRadius: 999, marginRight: 16 }}>
                            {getAccountIcon(account.type, colors.primary)}
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontFamily: 'BricolageGrotesque_700Bold', color: colors.text, fontSize: 18, marginBottom: 4 }}>{account.name}</Text>
                            <Text style={{ fontFamily: 'Manrope_500Medium', color: colors.textMuted, fontSize: 14 }}>{getAccountTypeLabel(account.type)}</Text>
                          </View>
                        </View>
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
    </View>
  );
}
