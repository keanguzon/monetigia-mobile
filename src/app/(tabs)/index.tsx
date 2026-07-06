import { useCallback, useState, useEffect } from "react";
import { View, Text, ScrollView, RefreshControl, ActivityIndicator, TouchableOpacity } from "react-native";
import { getSupabase } from "../../../lib/supabase";
import { LineChart } from "react-native-gifted-charts";
import { Wallet, ArrowDownLeft, ArrowUpRight, ArrowLeftRight } from "lucide-react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useSession } from "../_layout";
import { useTheme } from "../../theme/ThemeProvider";
import { GlassCard } from "../../components/ui/GlassCard";
import { DashboardSkeleton } from "../../components/ui/Skeletons";
import { DeviceEventEmitter } from "react-native";
import { EVENTS } from "../../lib/events";

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
  const [chartIncome, setChartIncome] = useState<any[]>([]);
  const [chartExpense, setChartExpense] = useState<any[]>([]);
  const [chartLabels, setChartLabels] = useState<string[]>([]);
  const router = useRouter();
  const { user } = useSession();
  const { colors } = useTheme();

  const loadData = async () => {
    try {
      if (!user) return;

      // 1. Fetch Accounts for Total Balance
      const { data: accounts, error: accountsError } = await getSupabase()
        .from("accounts")
        .select("balance, type, include_in_networth")
        .eq("user_id", user.id)
        .neq("type", "credit_card")
        .neq("include_in_networth", false);
      
      if (accountsError) throw accountsError;
      
      const total = (accounts || []).reduce((acc: number, curr: any) => acc + Number(curr.balance || 0), 0);
      
      const { data: debt, error: debtError } = await getSupabase().rpc("get_total_credit_card_debt", { p_user_id: user.id });
      if (debtError) throw debtError;
      
      const totalDebt = Number(debt || 0);
      
      setTotalBalance(total - totalDebt);

      // 2. Fetch Current Month Transactions (and rolling 7 days for chart)
      const now = new Date();
      const startOfMonthDate = new Date(now.getFullYear(), now.getMonth(), 1);
      
      const sevenDaysAgoDate = new Date();
      sevenDaysAgoDate.setDate(sevenDaysAgoDate.getDate() - 6);
      
      const fetchStartDate = startOfMonthDate < sevenDaysAgoDate ? startOfMonthDate : sevenDaysAgoDate;
      const pad = (num: number) => String(num).padStart(2, '0');
      const fetchStartString = `${fetchStartDate.getFullYear()}-${pad(fetchStartDate.getMonth() + 1)}-${pad(fetchStartDate.getDate())}T00:00:00`;

      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const endOfMonth = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(lastDay)}T23:59:59`;

      const { data: transactions, error: txError } = await getSupabase()
        .from("transactions")
        .select("amount, type, date, description, category:categories(name)")
        .eq("user_id", user.id)
        .gte("date", fetchStartString)
        .lte("date", endOfMonth)
        .order("date", { ascending: false })
        .limit(100);

      if (txError) throw txError;

      let income = 0;
      let expense = 0;
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();

      if (transactions) {
        transactions.forEach((t: any) => {
          if (!t.date) return;
          const localD = new Date(t.date);
          
          if (localD.getMonth() === currentMonth && localD.getFullYear() === currentYear) {
            if (t.type === "income") income += Number(t.amount || 0);
            if (t.type === "expense") expense += Number(t.amount || 0);
          }
        });
        setRecentTransactions(transactions.slice(0, 5));
        
        // --- NEW: Process data for Daily Trends Chart ---
        const dailyData: Record<string, { income: number; expense: number }> = {};
        const pad = (num: number) => String(num).padStart(2, '0');
        
        // Initialize the last 7 days to ensure the chart always has a base X-axis even if empty
        // Use manual local extraction to prevent `.toISOString()` from shifting the date to UTC yesterday.
        for (let i = 6; i >= 0; i--) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          const dateStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
          dailyData[dateStr] = { income: 0, expense: 0 };
        }

        // Aggregate actual transactions
        transactions.forEach((t: any) => {
          if (!t.date) return;
          // Hydrate UTC string from Supabase back to local Date, then extract local YYYY-MM-DD
          const localD = new Date(t.date);
          const dateKey = `${localD.getFullYear()}-${pad(localD.getMonth() + 1)}-${pad(localD.getDate())}`;
          
          if (dailyData[dateKey]) {
            if (t.type === 'income') {
              dailyData[dateKey].income = Number((dailyData[dateKey].income + Number(t.amount)).toFixed(2));
            } else if (t.type === 'expense') {
              dailyData[dateKey].expense = Number((dailyData[dateKey].expense + Number(t.amount)).toFixed(2));
            }
          }
        });

        const sortedDates = Object.keys(dailyData).sort();
        // Parse the YYYY-MM-DD string by manually passing parts to Date constructor 
        // to avoid the 'UTC midnight shift' for western hemisphere users.
        const formattedLabels = sortedDates.map(d => {
          const [y, m, day] = d.split('-');
          return new Date(Number(y), Number(m) - 1, Number(day)).toLocaleDateString('en-US', { weekday: 'short' });
        });
        
        const incomeLine = sortedDates.map(d => ({ value: dailyData[d].income }));
        const expenseLine = sortedDates.map(d => ({ value: dailyData[d].expense }));

        setChartLabels(formattedLabels);
        setChartIncome(incomeLine);
        setChartExpense(expenseLine);
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
    }, [user])
  );

  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener(EVENTS.TRANSACTION_ADDED, () => {
      loadData();
    });
    return () => subscription.remove();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  return (
    <ScrollView 
      style={{ flex: 1, backgroundColor: colors.background }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      <View style={{ padding: 24, paddingTop: 64 }}>
        <Text style={{ fontFamily: 'BricolageGrotesque_700Bold', fontSize: 30, color: colors.text, marginBottom: 24 }}>Dashboard</Text>

        {/* Total Balance Card */}
        <GlassCard style={{ marginBottom: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
            <Wallet color={colors.textMuted} size={20} />
            <Text style={{ fontFamily: 'Manrope_500Medium', color: colors.textMuted, marginLeft: 8 }}>Total Balance</Text>
          </View>
          <Text style={{ fontFamily: 'BricolageGrotesque_700Bold', fontSize: 36, color: colors.text }}>
            {formatCurrency(totalBalance)}
          </Text>
        </GlassCard>

        {/* Income / Expense Grid */}
        <View style={{ flexDirection: 'row', gap: 16, marginBottom: 32 }}>
          <GlassCard style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <View style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', padding: 8, borderRadius: 9999, marginRight: 8 }}>
                <ArrowDownLeft color="#10b981" size={16} />
              </View>
              <Text style={{ fontFamily: 'Manrope_500Medium', color: colors.textMuted, fontSize: 14 }}>Income</Text>
            </View>
            <Text style={{ fontFamily: 'BricolageGrotesque_700Bold', fontSize: 20, color: "#10b981" }}>
              {formatCurrency(monthlyIncome)}
            </Text>
          </GlassCard>
          <GlassCard style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <View style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: 8, borderRadius: 9999, marginRight: 8 }}>
                <ArrowUpRight color="#ef4444" size={16} />
              </View>
              <Text style={{ fontFamily: 'Manrope_500Medium', color: colors.textMuted, fontSize: 14 }}>Expense</Text>
            </View>
            <Text style={{ fontFamily: 'BricolageGrotesque_700Bold', fontSize: 20, color: "#ef4444" }}>
              {formatCurrency(monthlyExpense)}
            </Text>
          </GlassCard>
        </View>

        {/* Visual Analytics Chart (PC Parity) */}
        <View style={{ marginBottom: 32 }}>
          <Text style={{ fontFamily: 'BricolageGrotesque_700Bold', fontSize: 20, color: colors.text, marginBottom: 16 }}>Daily Trends</Text>
          <GlassCard style={{ padding: 16, paddingBottom: 24 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 16, marginBottom: 24 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#10b981' }} />
                <Text style={{ fontFamily: 'Manrope_500Medium', color: colors.textMuted, fontSize: 12 }}>Income</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#ef4444' }} />
                <Text style={{ fontFamily: 'Manrope_500Medium', color: colors.textMuted, fontSize: 12 }}>Expense</Text>
              </View>
            </View>
            <LineChart
              data={chartIncome}
              data2={chartExpense}
              color1="#10b981"
              color2="#ef4444"
              dataPointsColor1="#10b981"
              dataPointsColor2="#ef4444"
              areaChart
              startFillColor1="#10b981"
              startFillColor2="#ef4444"
              startOpacity={0.2}
              endOpacity={0.05}
              curved
              thickness={2}
              hideRules
              hideYAxisText
              yAxisThickness={0}
              xAxisThickness={0}
              initialSpacing={10}
              spacing={45}
              dataPointsRadius={3}
              xAxisLabelTexts={chartLabels}
              xAxisLabelTextStyle={{ color: colors.textMuted, fontFamily: 'Manrope_500Medium', fontSize: 10, textAlign: 'center' }}
            />
          </GlassCard>
        </View>

        {/* Recent Transactions */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <Text style={{ fontFamily: 'BricolageGrotesque_700Bold', fontSize: 20, color: colors.text }}>Recent Transactions</Text>
          <TouchableOpacity onPress={() => router.push("/transactions")}>
            <Text style={{ fontFamily: 'Manrope_500Medium', color: colors.primary }}>View All</Text>
          </TouchableOpacity>
        </View>

        <GlassCard style={{ padding: 0 }}>
          {recentTransactions.length > 0 ? (
            recentTransactions.map((t, idx) => (
              <View 
                key={idx} 
                style={[{ flexDirection: 'row', alignItems: 'center', padding: 16 }, idx !== recentTransactions.length - 1 ? { borderBottomWidth: 1, borderBottomColor: colors.border } : {}]}
              >
                <View style={[{ padding: 12, borderRadius: 9999, marginRight: 16 }, 
                  t.type === 'income' ? { backgroundColor: 'rgba(16, 185, 129, 0.1)' } : 
                  t.type === 'expense' ? { backgroundColor: 'rgba(239, 68, 68, 0.1)' } : { backgroundColor: 'rgba(59, 130, 246, 0.1)' }
                ]}>
                  {t.type === 'income' ? <ArrowDownLeft color="#10b981" size={20} /> :
                   t.type === 'expense' ? <ArrowUpRight color="#ef4444" size={20} /> :
                   <ArrowLeftRight color="#3b82f6" size={20} />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: 'Manrope_500Medium', color: colors.text, fontSize: 16, marginBottom: 4 }}>
                    {t.description || t.category?.name || "Transaction"}
                  </Text>
                  <Text style={{ fontFamily: 'Manrope_400Regular', color: colors.textMuted, fontSize: 12 }}>
                    {new Date(t.date).toLocaleDateString()}
                  </Text>
                </View>
                <Text style={[{ fontFamily: 'BricolageGrotesque_700Bold', fontSize: 16 }, 
                  t.type === 'income' ? { color: '#10b981' } : 
                  t.type === 'expense' ? { color: '#ef4444' } : { color: '#3b82f6' }
                ]}>
                  {t.type === 'income' ? '+' : t.type === 'expense' ? '-' : ''}
                  {formatCurrency(Number(t.amount))}
                </Text>
              </View>
            ))
          ) : (
            <View style={{ padding: 32, alignItems: 'center' }}>
              <Text style={{ fontFamily: 'Manrope_400Regular', color: colors.textMuted }}>No transactions this month</Text>
            </View>
          )}
        </GlassCard>
      </View>
    </ScrollView>
  );
}
