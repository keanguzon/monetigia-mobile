import { useEffect, useState } from "react";
import { View, Text, ScrollView, RefreshControl, ActivityIndicator, TouchableOpacity } from "react-native";
import { supabase } from "../../../lib/supabase";
import { ArrowDownLeft, ArrowUpRight, ArrowLeftRight } from "lucide-react-native";

// Utility formatting
const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(amount);
};

export default function TransactionsScreen() {
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [filter, setFilter] = useState<"all" | "expense" | "income" | "transfer">("all");

  const loadTransactions = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("transactions")
        .select("id, type, amount, description, date, category:categories(id,name,color), account:accounts!account_id(id,name,type)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .order("date", { ascending: false })
        .limit(50);

      if (data) {
        setTransactions(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadTransactions();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadTransactions();
  };

  const filteredTransactions = filter === "all" ? transactions : transactions.filter((t) => t.type === filter);

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-950">
        <ActivityIndicator size="large" color="#10b981" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-slate-950">
      <View className="px-6 pt-16 pb-4 bg-slate-950 z-10 border-b border-slate-900">
        <Text className="text-3xl font-bold text-white mb-4">Transactions</Text>
        
        {/* Filter Pills */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row gap-2">
          {["all", "expense", "income", "transfer"].map((f) => (
            <TouchableOpacity
              key={f}
              onPress={() => setFilter(f as any)}
              className={`px-4 py-2 rounded-full border mr-2 ${
                filter === f 
                  ? "bg-emerald-500/20 border-emerald-500/50" 
                  : "bg-slate-900 border-slate-800"
              }`}
            >
              <Text className={`font-medium capitalize ${filter === f ? "text-emerald-400" : "text-slate-400"}`}>
                {f}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView 
        className="flex-1"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#10b981" />}
      >
        <View className="p-6">
          <View className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
            {filteredTransactions.length > 0 ? (
              filteredTransactions.map((t, idx) => (
                <View 
                  key={t.id || idx} 
                  className={`flex-row items-center p-4 ${idx !== filteredTransactions.length - 1 ? 'border-b border-slate-800' : ''}`}
                >
                  <View className={`p-3 rounded-full mr-4 flex-shrink-0 ${
                    t.type === 'income' ? 'bg-green-500/10' : 
                    t.type === 'expense' ? 'bg-red-500/10' : 'bg-blue-500/10'
                  }`}>
                    {t.type === 'income' ? <ArrowDownLeft color="#10b981" size={20} /> :
                     t.type === 'expense' ? <ArrowUpRight color="#ef4444" size={20} /> :
                     <ArrowLeftRight color="#3b82f6" size={20} />}
                  </View>
                  <View className="flex-1 mr-2">
                    <Text className="text-white font-medium text-base mb-1" numberOfLines={1}>
                      {t.description || t.category?.name || (t.type === "transfer" ? "Transfer" : "Transaction")}
                    </Text>
                    <View className="flex-row flex-wrap items-center">
                      <Text className="text-slate-500 text-xs mr-2">{t.account?.name}</Text>
                      {t.category?.name && (
                        <Text className="text-slate-500 text-xs mr-2">• {t.category.name}</Text>
                      )}
                    </View>
                  </View>
                  <View className="items-end flex-shrink-0">
                    <Text className={`font-semibold text-base ${
                      t.type === 'income' ? 'text-green-400' : 
                      t.type === 'expense' ? 'text-red-400' : 'text-blue-400'
                    }`}>
                      {t.type === 'income' ? '+' : t.type === 'expense' ? '-' : ''}
                      {formatCurrency(Number(t.amount))}
                    </Text>
                    <Text className="text-slate-500 text-xs mt-1">
                      {new Date(t.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </Text>
                  </View>
                </View>
              ))
            ) : (
              <View className="p-12 items-center">
                <ArrowLeftRight color="#475569" size={40} className="mb-4" />
                <Text className="text-slate-400 text-center font-medium">No transactions found</Text>
                <Text className="text-slate-500 text-center text-sm mt-2">Try changing the filter</Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
