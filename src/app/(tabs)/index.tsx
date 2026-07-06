import { useCallback, useState, useEffect, useMemo } from "react";
import { View, Text, ScrollView, RefreshControl, ActivityIndicator, TouchableOpacity, ActionSheetIOS, Platform, Alert, useWindowDimensions } from "react-native";
import { getSupabase } from "../../../lib/supabase";
import { Wallet, ArrowDownLeft, ArrowUpRight, ArrowLeftRight, TrendingUp, ChevronDown } from "lucide-react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useSession } from "../_layout";
import { useTheme } from "../../theme/ThemeProvider";
import { GlassCard } from "../../components/ui/GlassCard";
import { DashboardSkeleton } from "../../components/ui/Skeletons";
import { AnimatedListItem } from "../../components/ui/AnimatedListItem";
import { DeviceEventEmitter } from "react-native";
import { EVENTS } from "../../lib/events";
import { formatCurrency } from "../../lib/utils";

export default function DashboardScreen() {
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [monthlyIncome, setMonthlyIncome] = useState(0);
  const [monthlyExpense, setMonthlyExpense] = useState(0);
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);
  const [dateRange, setDateRange] = useState<"last7" | "last30" | "thisMonth">("thisMonth");

  // Debt preview states
  const [accounts, setAccounts] = useState<any[]>([]);
  const [previewAfterPay, setPreviewAfterPay] = useState(false);
  const [debtByMonth, setDebtByMonth] = useState<Record<string, number>>({});
  const [selectedDebtMonths, setSelectedDebtMonths] = useState<string[]>([]);
  const [isDebtLoading, setIsDebtLoading] = useState(false);

  const router = useRouter();
  const { user } = useSession();
  const { colors } = useTheme();

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

  const getDateRange = (range: "last7" | "last30" | "thisMonth") => {
    const toDateString = (date: Date) => {
      const pad = (num: number) => String(num).padStart(2, '0');
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
    };
    const today = new Date();
    const end = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    if (range === "thisMonth") {
      const currentStart = new Date(today.getFullYear(), today.getMonth(), 1);
      return {
        currentStart: toDateString(currentStart) + "T00:00:00",
        currentEnd: toDateString(end) + "T23:59:59",
        days: today.getDate(),
        startDateObj: currentStart
      };
    }

    const days = range === "last7" ? 7 : 30;
    const currentStart = new Date(end);
    currentStart.setDate(currentStart.getDate() - (days - 1));

    return {
      currentStart: toDateString(currentStart) + "T00:00:00",
      currentEnd: toDateString(end) + "T23:59:59",
      days: days,
      startDateObj: currentStart
    };
  };

  const loadData = async () => {
    try {
      if (!user) return;

      // 1. Fetch Accounts for Total Balance
      const { data: accountsData, error: accountsError } = await getSupabase()
        .from("accounts")
        .select("*")
        .eq("user_id", user.id);
      
      if (accountsError) throw accountsError;
      
      if (accountsData) {
        let accountsList = [...accountsData];
        setAccounts(accountsList);
        
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
              
              setAccounts(prev => prev.map((a: any) =>
                a?.type === "credit_card" && a?.id
                  ? { ...a, balance: Number(nextCreditBalanceById[a.id] || 0) }
                  : a
              ));
            }
          }
        }
        setIsDebtLoading(false);
      }

      // 2. Fetch Transactions based on Date Range
      const { currentStart, currentEnd } = getDateRange(dateRange);

      const { data: transactions, error: txError } = await getSupabase()
        .from("transactions")
        .select("amount, type, date, description, category:categories(name)")
        .eq("user_id", user.id)
        .gte("date", currentStart)
        .lte("date", currentEnd)
        .order("date", { ascending: false })
        .limit(100);

      if (txError) throw txError;

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
    }, [user, dateRange])
  );

  useEffect(() => {
    loadData();
  }, [dateRange]);

  useEffect(() => {
    const sub1 = DeviceEventEmitter.addListener(EVENTS.ACCOUNT_ADDED, loadData);
    const sub2 = DeviceEventEmitter.addListener(EVENTS.ACCOUNT_UPDATED, loadData);
    const sub3 = DeviceEventEmitter.addListener(EVENTS.TRANSACTION_ADDED, loadData);
    return () => {
      sub1.remove();
      sub2.remove();
      sub3.remove();
    };
  }, [dateRange]);

  const handleDateRangeSelect = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'This Month', 'Last 7 Days', 'Last 30 Days'],
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) setDateRange('thisMonth');
          else if (buttonIndex === 2) setDateRange('last7');
          else if (buttonIndex === 3) setDateRange('last30');
        }
      );
    } else {
      Alert.alert(
        'Select Date Range',
        '',
        [
          { text: 'This Month', onPress: () => setDateRange('thisMonth') },
          { text: 'Last 7 Days', onPress: () => setDateRange('last7') },
          { text: 'Last 30 Days', onPress: () => setDateRange('last30') },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
    }
  };

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
      <View style={{ padding: 24, paddingTop: 64, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ fontFamily: 'BricolageGrotesque_700Bold', fontSize: 30, color: colors.text }}>Dashboard</Text>
        <TouchableOpacity 
          onPress={handleDateRangeSelect}
          style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.border, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 }}
        >
          <Text style={{ color: colors.text, fontSize: 14, fontFamily: 'Manrope_500Medium', marginRight: 4 }}>
            {dateRange === 'thisMonth' ? 'This Month' : dateRange === 'last7' ? 'Last 7 Days' : 'Last 30 Days'}
          </Text>
          <ChevronDown color={colors.text} size={16} />
        </TouchableOpacity>
      </View>
      <View style={{ paddingHorizontal: 24 }}>

        {/* Combined Net Worth / Debt Balance Card with Preview */}
        <GlassCard style={{ padding: 20, marginBottom: 16, gap: 16 }}>
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

        {/* Income / Expense Grid */}
        <View style={{ flexDirection: 'row', gap: 16, marginBottom: 24 }}>
          <GlassCard style={{ flex: 1, padding: 20 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <View style={{ backgroundColor: 'rgba(34, 197, 94, 0.1)', padding: 8, borderRadius: 9999, marginRight: 8 }}>
                <ArrowDownLeft color={colors.primary} size={16} />
              </View>
              <Text style={{ fontFamily: 'Manrope_500Medium', color: colors.textMuted, fontSize: 14 }}>Income</Text>
            </View>
            <Text style={{ fontFamily: 'BricolageGrotesque_700Bold', fontSize: 20, color: colors.primary }}>
              {formatCurrency(monthlyIncome)}
            </Text>
          </GlassCard>
          <GlassCard style={{ flex: 1, padding: 20 }}>
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

        {/* Net Savings */}
        <GlassCard style={{ marginBottom: 32, padding: 20 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
            <View style={{ backgroundColor: monthlyIncome - monthlyExpense >= 0 ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)', padding: 8, borderRadius: 9999, marginRight: 8 }}>
              <TrendingUp color={monthlyIncome - monthlyExpense >= 0 ? colors.primary : '#ef4444'} size={16} />
            </View>
            <Text style={{ fontFamily: 'Manrope_500Medium', color: colors.textMuted, fontSize: 14 }}>Net Savings</Text>
          </View>
          <Text style={{ fontFamily: 'BricolageGrotesque_700Bold', fontSize: 20, color: monthlyIncome - monthlyExpense >= 0 ? colors.primary : '#ef4444' }}>
            {formatCurrency(monthlyIncome - monthlyExpense)}
          </Text>
        </GlassCard>

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
              <AnimatedListItem key={idx} delay={idx * 80}>
                <View 
                style={[{ flexDirection: 'row', alignItems: 'center', padding: 16 }, idx !== recentTransactions.length - 1 ? { borderBottomWidth: 1, borderBottomColor: colors.border } : {}]}
              >
                <View style={[{ padding: 12, borderRadius: 9999, marginRight: 16 }, 
                  t.type === 'income' ? { backgroundColor: 'rgba(34, 197, 94, 0.1)' } : 
                  t.type === 'expense' ? { backgroundColor: 'rgba(239, 68, 68, 0.1)' } : { backgroundColor: 'rgba(59, 130, 246, 0.1)' }
                ]}>
                  {t.type === 'income' ? <ArrowDownLeft color={colors.primary} size={20} /> :
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
                  t.type === 'income' ? { color: colors.primary } : 
                  t.type === 'expense' ? { color: '#ef4444' } : { color: '#3b82f6' }
                ]}>
                  {t.type === 'income' ? '+' : t.type === 'expense' ? '-' : ''}
                  {formatCurrency(Number(t.amount))}
                </Text>
              </View>
              </AnimatedListItem>
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
