import { useCallback, useState } from "react";
import { View, Text, ScrollView, RefreshControl, ActivityIndicator, TouchableOpacity } from "react-native";
import { supabase } from "../../../lib/supabase";
import { Wallet, ArrowDownLeft, ArrowUpRight, ArrowLeftRight } from "lucide-react-native";
import { useRouter, useFocusEffect } from "expo-router";

// Utility formatting
const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(amount);
};

export default function DashboardScreen() {
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [totalBalance, setTotalBalance] = useState(0);
  const [monthlyIncome, setMonthlyIncome] = useState(0);
  const [monthlyExpense, setMonthlyExpense] = useState(0);
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);
  const router = useRouter();

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 1. Fetch Accounts for Total Balance
      const { data: accounts } = await supabase
        .from("accounts")
        .select("balance, type, include_in_networth")
        .eq("user_id", user.id)
        .neq("type", "credit_card")
        .neq("include_in_networth", false);
      
      const total = (accounts || []).reduce((acc: number, curr: any) => acc + Number(curr.balance || 0), 0);
      
      const { data: debt } = await supabase.rpc("get_total_credit_card_debt", { p_user_id: user.id });
      const totalDebt = Number(debt || 0);
      
      setTotalBalance(total - totalDebt);

      // 2. Fetch Current Month Transactions for Income/Expense
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();

      const { data: transactions } = await supabase
        .from("transactions")
        .select("amount, type, date, description, category:categories(name)")
        .eq("user_id", user.id)
        .gte("date", startOfMonth)
        .lte("date", endOfMonth)
        .order("date", { ascending: false })
        .limit(100);

      let income = 0;
      let expense = 0;
      if (transactions) {
        transactions.forEach((t: any) => {
          if (t.type === "income") income += Number(t.amount || 0);
          if (t.type === "expense") expense += Number(t.amount || 0);
        });
        setRecentTransactions(transactions.slice(0, 5));
      }
      setMonthlyIncome(income);
      setMonthlyExpense(expense);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
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
        <Text className="text-3xl font-bold text-white mb-6">Dashboard</Text>

        {/* Total Balance Card */}
        <View className="bg-slate-900 border border-slate-800 rounded-2xl p-6 mb-4 shadow-sm">
          <View className="flex-row items-center mb-2">
            <Wallet color="#94a3b8" size={20} />
            <Text className="text-slate-400 font-medium ml-2">Total Balance</Text>
          </View>
          <Text className="text-4xl font-bold text-white">
            {formatCurrency(totalBalance)}
          </Text>
        </View>

        {/* Income / Expense Grid */}
        <View className="flex-row gap-4 mb-8">
          <View className="flex-1 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm">
            <View className="flex-row items-center mb-2">
              <View className="bg-green-500/10 p-2 rounded-full mr-2">
                <ArrowDownLeft color="#10b981" size={16} />
              </View>
              <Text className="text-slate-400 font-medium text-sm">Income</Text>
            </View>
            <Text className="text-xl font-semibold text-green-400">
              {formatCurrency(monthlyIncome)}
            </Text>
          </View>
          <View className="flex-1 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm">
            <View className="flex-row items-center mb-2">
              <View className="bg-red-500/10 p-2 rounded-full mr-2">
                <ArrowUpRight color="#ef4444" size={16} />
              </View>
              <Text className="text-slate-400 font-medium text-sm">Expense</Text>
            </View>
            <Text className="text-xl font-semibold text-red-400">
              {formatCurrency(monthlyExpense)}
            </Text>
          </View>
        </View>

        {/* Recent Transactions */}
        <View className="flex-row justify-between items-center mb-4">
          <Text className="text-xl font-semibold text-white">Recent Transactions</Text>
          <TouchableOpacity onPress={() => router.push("/transactions")}>
            <Text className="text-emerald-500 font-medium">View All</Text>
          </TouchableOpacity>
        </View>

        <View className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
          {recentTransactions.length > 0 ? (
            recentTransactions.map((t, idx) => (
              <View 
                key={idx} 
                className={`flex-row items-center p-4 ${idx !== recentTransactions.length - 1 ? 'border-b border-slate-800' : ''}`}
              >
                <View className={`p-3 rounded-full mr-4 ${
                  t.type === 'income' ? 'bg-green-500/10' : 
                  t.type === 'expense' ? 'bg-red-500/10' : 'bg-blue-500/10'
                }`}>
                  {t.type === 'income' ? <ArrowDownLeft color="#10b981" size={20} /> :
                   t.type === 'expense' ? <ArrowUpRight color="#ef4444" size={20} /> :
                   <ArrowLeftRight color="#3b82f6" size={20} />}
                </View>
                <View className="flex-1">
                  <Text className="text-white font-medium text-base mb-1">
                    {t.description || t.category?.name || "Transaction"}
                  </Text>
                  <Text className="text-slate-500 text-xs">
                    {new Date(t.date).toLocaleDateString()}
                  </Text>
                </View>
                <Text className={`font-semibold text-base ${
                  t.type === 'income' ? 'text-green-400' : 
                  t.type === 'expense' ? 'text-red-400' : 'text-blue-400'
                }`}>
                  {t.type === 'income' ? '+' : t.type === 'expense' ? '-' : ''}
                  {formatCurrency(Number(t.amount))}
                </Text>
              </View>
            ))
          ) : (
            <View className="p-8 items-center">
              <Text className="text-slate-500">No transactions this month</Text>
            </View>
          )}
        </View>
      </View>
    </ScrollView>
  );
}
