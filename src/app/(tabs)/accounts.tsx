import { useEffect, useState } from "react";
import { View, Text, ScrollView, RefreshControl, ActivityIndicator } from "react-native";
import { getSupabase } from "../../../lib/supabase";
import { Wallet, Landmark, CreditCard, Building2, TrendingUp, PiggyBank } from "lucide-react-native";
import { useSession } from "../_layout";

// Utility formatting
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
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [accounts, setAccounts] = useState<any[]>([]);
  const { user } = useSession();

  const loadAccounts = async () => {
    try {
      if (!user) return;

      const { data } = await getSupabase()
        .from("accounts")
        .select("*")
        .eq("user_id", user.id)
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

  useEffect(() => {
    loadAccounts();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadAccounts();
  };

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-950">
        <ActivityIndicator size="large" color="#10b981" />
      </View>
    );
  }

  return (
    <ScrollView 
      className="flex-1 bg-slate-950"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#10b981" />}
    >
      <View className="p-6 pt-16">
        <Text className="text-3xl font-bold text-white mb-2">Accounts</Text>
        <Text className="text-slate-400 mb-6">Your wallets and balances</Text>

        <View className="space-y-4 flex flex-col gap-4">
          {accounts.map((account) => {
            const isDebt = account.type === "credit_card";
            const balance = Number(account.balance || 0);

            return (
              <View key={account.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm">
                <View className="flex-row items-center justify-between mb-4">
                  <View className="flex-row items-center flex-1">
                    <View className="bg-slate-800 p-3 rounded-full mr-3">
                      {getAccountIcon(account.type, "#10b981")}
                    </View>
                    <View className="flex-1">
                      <Text className="text-white font-semibold text-lg">{account.name}</Text>
                      <Text className="text-slate-400 text-sm">{getAccountTypeLabel(account.type)}</Text>
                    </View>
                  </View>
                </View>

                <View className="flex-row justify-between items-end border-t border-slate-800 pt-4">
                  <Text className="text-slate-400">Balance</Text>
                  <Text className={`text-2xl font-bold ${isDebt && balance > 0 ? "text-red-400" : "text-white"}`}>
                    {isDebt && balance > 0 ? "-" : ""}{formatCurrency(balance)}
                  </Text>
                </View>
              </View>
            );
          })}

          {accounts.length === 0 && (
            <View className="py-12 items-center justify-center">
              <Wallet color="#475569" size={48} />
              <Text className="text-slate-400 mt-4 text-center">No accounts found.</Text>
            </View>
          )}
        </View>
      </View>
    </ScrollView>
  );
}
