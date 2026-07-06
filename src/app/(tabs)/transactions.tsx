import React, { useEffect, useState, useCallback, useRef } from "react";
import { View, Text, FlatList, RefreshControl, ActivityIndicator, TouchableOpacity, TextInput, DeviceEventEmitter, Alert, StyleSheet, ScrollView } from "react-native";
import { getSupabase } from "../../../lib/supabase";
import { ArrowDownLeft, ArrowUpRight, ArrowLeftRight, Search, SlidersHorizontal, Trash2 } from "lucide-react-native";
import { useSession } from "../_layout";
import { useTheme } from "../../theme/ThemeProvider";
import { GlassCard } from "../../components/ui/GlassCard";
import { TransactionDetailModal } from "../../components/transactions/TransactionDetailModal";
import { TransactionRowSkeleton } from "../../components/ui/Skeletons";
import { EVENTS } from "../../lib/events";
import { Swipeable } from "react-native-gesture-handler";
import * as Haptics from "expo-haptics";
import { useFocusEffect } from "expo-router";
import { formatCurrency } from "../../lib/utils";

const PAGE_SIZE = 20;

type DateRangeType = "all" | "today" | "week" | "month";

export default function TransactionsScreen() {
  const { colors } = useTheme();
  const { user } = useSession();

  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);

  // Filtering states
  const [typeFilter, setTypeFilter] = useState<"all" | "expense" | "income" | "transfer">("all");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRangeType>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // Pagination states
  const [lastDateCursor, setLastDateCursor] = useState<string | null>(null);
  const [lastCreatedAtCursor, setLastCreatedAtCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);

  // Modal states
  const [selectedTransaction, setSelectedTransaction] = useState<any | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);

  // Active Swipeable ref to close them on interaction
  const activeSwipeableRef = useRef<any>(null);

  // References to handle request concurrency and race conditions
  const activeFetchIdRef = useRef(0);
  const debounceTimeoutRef = useRef<any>(null);

  const toLocalISOWithOffset = (d: Date) => {
    const offset = -d.getTimezoneOffset();
    const absOffset = Math.abs(offset);
    const sign = offset >= 0 ? '+' : '-';
    const pad = (num: number) => String(Math.floor(num)).padStart(2, '0');
    
    const hoursOffset = pad(Math.floor(absOffset / 60));
    const minsOffset = pad(absOffset % 60);
    const tzString = `${sign}${hoursOffset}:${minsOffset}`;
    
    const y = d.getFullYear();
    const m = pad(d.getMonth() + 1);
    const dayVal = pad(d.getDate());
    const h = pad(d.getHours());
    const min = pad(d.getMinutes());
    const s = pad(d.getSeconds());
    
    return `${y}-${m}-${dayVal}T${h}:${min}:${s}${tzString}`;
  };

  const loadDependencies = async () => {
    try {
      if (!user) return;
      const { data, error } = await getSupabase()
        .from("categories")
        .select("id, name, color")
        .eq("user_id", user.id);

      if (error) throw error;
      setCategories(data || []);
    } catch (err) {
      console.error("Error loading categories", err);
    }
  };

  const buildQuery = useCallback((cursorDate: string | null, cursorCreatedAt: string | null) => {
    if (!user) return null;
    let query = getSupabase()
      .from("transactions")
      .select(`
        id, type, amount, description, date, created_at, transfer_to_account_id,
        category:categories(id,name,color), 
        account:accounts!account_id(id,name,type),
        transfer_to_account:accounts!transfer_to_account_id(id,name,type)
      `)
      .eq("user_id", user.id);

    // 1. Filter by Type
    if (typeFilter !== "all") {
      query = query.eq("type", typeFilter);
    }

    // 2. Filter by Category
    if (selectedCategoryId && typeFilter !== "transfer") {
      query = query.eq("category_id", selectedCategoryId);
    }

    // 3. Timezone-Safe Date Range Filtering with upper cap to prevent future data leakage
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const dateVal = now.getDate();
    const todayEnd = new Date(year, month, dateVal, 23, 59, 59, 999);

    if (dateRange === "today") {
      const todayStart = new Date(year, month, dateVal, 0, 0, 0, 0);
      query = query
        .gte("date", toLocalISOWithOffset(todayStart))
        .lte("date", toLocalISOWithOffset(todayEnd));
    } else if (dateRange === "week") {
      const weekStart = new Date(year, month, dateVal - 6, 0, 0, 0, 0);
      query = query
        .gte("date", toLocalISOWithOffset(weekStart))
        .lte("date", toLocalISOWithOffset(todayEnd));
    } else if (dateRange === "month") {
      const monthStart = new Date(year, month, 1, 0, 0, 0, 0);
      query = query
        .gte("date", toLocalISOWithOffset(monthStart))
        .lte("date", toLocalISOWithOffset(todayEnd));
    }

    // 4. Search Query (Client side description filter, or server-side description search)
    if (searchQuery.trim()) {
      query = query.ilike("description", `%${searchQuery.trim()}%`);
    }

    // 5. Cursor-based pagination filter
    if (cursorDate && cursorCreatedAt) {
      // Use double quotes for date cursor to handle special character timezone offset (+/-)
      query = query.or(`date.lt."${cursorDate}",and(date.eq."${cursorDate}",created_at.lt."${cursorCreatedAt}")`);
    }

    // Sort strictly by Date DESC and Created At DESC
    query = query
      .order("date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(PAGE_SIZE);

    return query;
  }, [user, typeFilter, selectedCategoryId, dateRange, searchQuery]);

  const loadFirstPage = async () => {
    if (!user) return;
    const fetchId = ++activeFetchIdRef.current;
    try {
      const query = buildQuery(null, null);
      if (!query) return;

      const { data, error } = await query;
      if (error) throw error;

      // Discard stale responses to prevent rapid switching race conditions
      if (fetchId !== activeFetchIdRef.current) return;

      setTransactions(data || []);

      if (data && data.length === PAGE_SIZE) {
        const lastItem = data[data.length - 1];
        setLastDateCursor(lastItem.date);
        setLastCreatedAtCursor(lastItem.created_at);
        setHasMore(true);
      } else {
        setLastDateCursor(null);
        setLastCreatedAtCursor(null);
        setHasMore(false);
      }
    } catch (err) {
      console.error("Error loading transactions first page", err);
    } finally {
      if (fetchId === activeFetchIdRef.current) {
        setIsLoading(false);
        setRefreshing(false);
      }
    }
  };

  const debouncedLoadFirstPage = useCallback(() => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
    debounceTimeoutRef.current = setTimeout(() => {
      loadFirstPage();
    }, 50);
  }, [user, typeFilter, selectedCategoryId, dateRange, searchQuery]);

  const loadNextPage = async () => {
    if (isFetchingMore || !hasMore || !user || !lastDateCursor || !lastCreatedAtCursor) return;
    setIsFetchingMore(true);

    try {
      const query = buildQuery(lastDateCursor, lastCreatedAtCursor);
      if (!query) return;

      const { data, error } = await query;
      if (error) throw error;

      if (data && data.length > 0) {
        setTransactions((prev) => [...prev, ...data]);

        if (data.length === PAGE_SIZE) {
          const lastItem = data[data.length - 1];
          setLastDateCursor(lastItem.date);
          setLastCreatedAtCursor(lastItem.created_at);
          setHasMore(true);
        } else {
          setLastDateCursor(null);
          setLastCreatedAtCursor(null);
          setHasMore(false);
        }
      } else {
        setHasMore(false);
      }
    } catch (err) {
      console.error("Error loading next page", err);
    } finally {
      setIsFetchingMore(false);
    }
  };

  // Trigger reloading on query dependencies change
  useFocusEffect(
    useCallback(() => {
      setIsLoading(true);
      debouncedLoadFirstPage();
    }, [user, typeFilter, selectedCategoryId, dateRange, searchQuery])
  );

  useEffect(() => {
    loadDependencies();
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [user]);

  useEffect(() => {
    const sub1 = DeviceEventEmitter.addListener(EVENTS.TRANSACTION_ADDED, () => {
      debouncedLoadFirstPage();
    });
    const sub2 = DeviceEventEmitter.addListener(EVENTS.ACCOUNT_UPDATED, () => {
      debouncedLoadFirstPage();
    });
    return () => {
      sub1.remove();
      sub2.remove();
    };
  }, [typeFilter, selectedCategoryId, dateRange, searchQuery]);

  const onRefresh = () => {
    setRefreshing(true);
    debouncedLoadFirstPage();
    loadDependencies();
  };

  const handleRowPress = (tx: any) => {
    if (activeSwipeableRef.current) {
      activeSwipeableRef.current.close();
    }
    setSelectedTransaction(tx);
    setDetailModalVisible(true);
  };

  const handleDeleteTransaction = (tx: any) => {
    if (activeSwipeableRef.current) {
      activeSwipeableRef.current.close();
    }
    Alert.alert(
      "Delete Transaction",
      "Are you sure you want to delete this transaction? The account balance will be atomically reverted.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const { error } = await getSupabase().rpc('delete_transaction_atomic', {
                p_transaction_id: tx.id,
                p_user_id: user!.id
              });

              if (error) throw error;

              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              DeviceEventEmitter.emit(EVENTS.TRANSACTION_ADDED);
              DeviceEventEmitter.emit(EVENTS.ACCOUNT_UPDATED);
            } catch (err: any) {
              Alert.alert("Error", err.message || "Failed to delete transaction.");
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            }
          }
        }
      ]
    );
  };

  const renderRightActions = (tx: any) => {
    return (
      <TouchableOpacity 
        style={[styles.deleteAction, { backgroundColor: '#ef4444' }]}
        onPress={() => handleDeleteTransaction(tx)}
      >
        <Trash2 color="#fff" size={24} />
      </TouchableOpacity>
    );
  };

  const renderItem = ({ item }: { item: any }) => {
    if (isLoading) {
      return <TransactionRowSkeleton />;
    }
    const isIncome = item.type === "income";
    const isExpense = item.type === "expense";
    let swipeableRef: any = null;
    
    return (
      <Swipeable 
        ref={ref => { swipeableRef = ref; }}
        renderRightActions={() => renderRightActions(item)}
        overshootRight={false}
        onSwipeableWillOpen={() => {
          if (activeSwipeableRef.current && activeSwipeableRef.current !== swipeableRef) {
            activeSwipeableRef.current.close();
          }
          activeSwipeableRef.current = swipeableRef;
        }}
      >
        <TouchableOpacity activeOpacity={0.8} onPress={() => handleRowPress(item)}>
          <GlassCard style={styles.cardItem}>
            <View style={styles.cardLeft}>
              <View style={[
                styles.iconCircle, 
                { backgroundColor: isIncome ? 'rgba(34, 197, 94, 0.1)' : isExpense ? 'rgba(239, 68, 68, 0.1)' : 'rgba(59, 130, 246, 0.1)' }
              ]}>
                {isIncome ? <ArrowDownLeft color={colors.primary} size={20} /> :
                 isExpense ? <ArrowUpRight color="#ef4444" size={20} /> :
                 <ArrowLeftRight color="#3b82f6" size={20} />}
              </View>
              
              <View style={{ flex: 1 }}>
                <Text style={[styles.descText, { color: colors.text }]} numberOfLines={1}>
                  {item.description || item.category?.name || (item.type === "transfer" ? "Transfer" : "Transaction")}
                </Text>
                <View style={styles.subtextRow}>
                  <Text style={{ color: colors.textMuted, fontSize: 12, fontFamily: 'Manrope_400Regular' }}>
                    {item.account?.name}
                  </Text>
                  {item.type === "transfer" && item.transfer_to_account?.name && (
                    <Text style={{ color: colors.textMuted, fontSize: 12, fontFamily: 'Manrope_400Regular' }}>
                      {" ➔ "}{item.transfer_to_account.name}
                    </Text>
                  )}
                  {item.category?.name && item.type !== "transfer" && (
                    <Text style={{ color: colors.textMuted, fontSize: 12, fontFamily: 'Manrope_400Regular' }}>
                      {" • "}{item.category.name}
                    </Text>
                  )}
                </View>
              </View>
            </View>

            <View style={styles.cardRight}>
              <Text style={[
                styles.amountVal, 
                { color: isIncome ? colors.primary : isExpense ? '#ef4444' : '#3b82f6' }
              ]}>
                {isIncome ? '+' : isExpense ? '-' : ''}
                {formatCurrency(Number(item.amount))}
              </Text>
              <Text style={{ color: colors.textMuted, fontSize: 11, fontFamily: 'Manrope_400Regular', marginTop: 4 }}>
                {new Date(item.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              </Text>
            </View>
          </GlassCard>
        </TouchableOpacity>
      </Swipeable>
    );
  };

  const renderHeader = () => (
    <View style={[styles.headerContainer, { borderBottomColor: colors.border }]}>
      <View style={styles.titleRow}>
        <Text style={[styles.titleText, { color: colors.text }]}>Transactions</Text>
        <TouchableOpacity onPress={() => setShowAdvancedFilters(!showAdvancedFilters)}>
          <SlidersHorizontal color={showAdvancedFilters ? colors.primary : colors.textMuted} size={20} />
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={[styles.searchBar, { backgroundColor: 'rgba(255,255,255,0.05)', borderColor: colors.border }]}>
        <Search color={colors.textMuted} size={18} style={styles.searchIcon} />
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder="Search transactions..."
          placeholderTextColor={colors.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* Pill filter list (Type) */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillScroll}>
        {(["all", "expense", "income", "transfer"] as const).map((type) => {
          const isSelected = typeFilter === type;
          return (
            <TouchableOpacity
              key={type}
              onPress={() => {
                setTypeFilter(type);
                setSelectedCategoryId(null); // Reset category if switching types
              }}
              style={[
                styles.typePill,
                {
                  borderColor: isSelected ? colors.primary : colors.border,
                  backgroundColor: isSelected ? 'rgba(34, 197, 94, 0.1)' : 'transparent',
                }
              ]}
            >
              <Text style={{ color: isSelected ? colors.primary : colors.text, fontFamily: 'Manrope_500Medium', textTransform: 'capitalize' }}>
                {type}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Advanced Filters (Category, Date Range) */}
      {showAdvancedFilters && (
        <View style={[styles.advancedContainer, { borderTopColor: colors.border }]}>
          {/* Date Range Selection */}
          <View style={styles.filterSection}>
            <Text style={[styles.filterLabel, { color: colors.textMuted }]}>Date Range</Text>
            <View style={styles.filterRow}>
              {([
                { id: "all", label: "All Time" },
                { id: "today", label: "Today" },
                { id: "week", label: "This Week" },
                { id: "month", label: "This Month" }
              ] as const).map((range) => {
                const isSelected = dateRange === range.id;
                return (
                  <TouchableOpacity
                    key={range.id}
                    onPress={() => setDateRange(range.id)}
                    style={[
                      styles.subPill,
                      {
                        borderColor: isSelected ? colors.primary : colors.border,
                        backgroundColor: isSelected ? 'rgba(34, 197, 94, 0.1)' : 'transparent',
                      }
                    ]}
                  >
                    <Text style={{ color: isSelected ? colors.primary : colors.text, fontSize: 12, fontFamily: 'Manrope_500Medium' }}>
                      {range.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Category selection */}
          {typeFilter !== "transfer" && (
            <View style={styles.filterSection}>
              <Text style={[styles.filterLabel, { color: colors.textMuted }]}>Categories</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRowScroll}>
                <TouchableOpacity
                  onPress={() => setSelectedCategoryId(null)}
                  style={[
                    styles.subPill,
                    {
                      borderColor: !selectedCategoryId ? colors.primary : colors.border,
                      backgroundColor: !selectedCategoryId ? 'rgba(34, 197, 94, 0.1)' : 'transparent',
                    }
                  ]}
                >
                  <Text style={{ color: !selectedCategoryId ? colors.primary : colors.text, fontSize: 12, fontFamily: 'Manrope_500Medium' }}>
                    All Categories
                  </Text>
                </TouchableOpacity>
                {categories.map((cat) => {
                  const isSelected = selectedCategoryId === cat.id;
                  return (
                    <TouchableOpacity
                      key={cat.id}
                      onPress={() => setSelectedCategoryId(cat.id)}
                      style={[
                        styles.subPill,
                        {
                          borderColor: isSelected ? colors.primary : colors.border,
                          backgroundColor: isSelected ? 'rgba(34, 197, 94, 0.1)' : 'transparent',
                        }
                      ]}
                    >
                      <Text style={{ color: isSelected ? colors.primary : colors.text, fontSize: 12, fontFamily: 'Manrope_500Medium' }}>
                        {cat.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}
        </View>
      )}
    </View>
  );

  const renderFooter = () => {
    if (!isFetchingMore) return null;
    return (
      <View style={{ paddingVertical: 20 }}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  };

  const renderEmpty = () => {
    if (isLoading) return null;
    return (
      <View style={styles.emptyView}>
        <ArrowLeftRight color={colors.border} size={48} />
        <Text style={{ color: colors.textMuted, fontFamily: 'Manrope_500Medium', marginTop: 16 }}>
          No transactions found.
        </Text>
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <FlatList
        data={isLoading ? [{ id: 'skel-1' }, { id: 'skel-2' }, { id: 'skel-3' }, { id: 'skel-4' }, { id: 'skel-5' }] : transactions}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={renderHeader}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={renderEmpty}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        onEndReached={loadNextPage}
        onEndReachedThreshold={0.2}
        contentContainerStyle={{ paddingBottom: 40 }}
      />

      {/* Transaction Detail & Edit Modal */}
      <TransactionDetailModal
        visible={detailModalVisible}
        onClose={() => setDetailModalVisible(false)}
        transaction={selectedTransaction}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  headerContainer: { padding: 24, paddingTop: 64, borderBottomWidth: 1, marginBottom: 16 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  titleText: { fontFamily: 'BricolageGrotesque_700Bold', fontSize: 30 },
  searchBar: { flexDirection: 'row', alignItems: 'center', height: 48, borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, marginBottom: 16 },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, fontFamily: 'Manrope_500Medium', fontSize: 14, padding: 0 },
  pillScroll: { flexDirection: 'row' },
  typePill: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999, borderWidth: 1, marginRight: 8 },
  advancedContainer: { marginTop: 16, borderTopWidth: 1, paddingTop: 16, gap: 16 },
  filterSection: { gap: 8 },
  filterLabel: { fontFamily: 'Manrope_500Medium', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filterRowScroll: { flexDirection: 'row' },
  subPill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1, marginRight: 8 },
  cardItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, marginHorizontal: 20, marginBottom: 8 },
  cardLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 },
  iconCircle: { padding: 10, borderRadius: 999, marginRight: 12 },
  descText: { fontFamily: 'BricolageGrotesque_700Bold', fontSize: 16, marginBottom: 4, flexShrink: 1 },
  subtextRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  cardRight: { alignItems: 'flex-end' },
  amountVal: { fontFamily: 'BricolageGrotesque_700Bold', fontSize: 16 },
  deleteAction: { width: 80, height: '90%', justifyContent: 'center', alignItems: 'center', borderRadius: 16, alignSelf: 'center', marginBottom: 8, marginRight: 20 },
  emptyView: { paddingVertical: 80, alignItems: 'center', justifyContent: 'center' }
});
