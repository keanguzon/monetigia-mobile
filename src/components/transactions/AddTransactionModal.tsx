import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, TextInput, ActivityIndicator, Platform, StyleSheet, ScrollView, DeviceEventEmitter } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassCard } from '../ui/GlassCard';
import { useTheme } from '../../theme/ThemeProvider';
import { getSupabase } from '../../../lib/supabase';
import { useSession } from '../../app/_layout';
import DateTimePicker from '@react-native-community/datetimepicker';
import { X } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { EVENTS } from '../../lib/events';
import { toLocalISOWithOffset } from '../../lib/utils';
import { BottomSheetModal, BottomSheetScrollView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import CurrencyInput from 'react-native-currency-input';

interface Props {
  visible: boolean;
  onClose: () => void;
  initialAccountId?: string | null;
}

export const AddTransactionModal: React.FC<Props> = ({ visible, onClose, initialAccountId }) => {
  const { colors } = useTheme();
  const { user } = useSession();
  const insets = useSafeAreaInsets();

  const [type, setType] = useState<'expense' | 'income' | 'transfer'>('expense');
  const [amount, setAmount] = useState<number | null>(null);
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  
  const [accounts, setAccounts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [transferToAccountId, setTransferToAccountId] = useState<string | null>(null);
  const [isPayLater, setIsPayLater] = useState(false);
  const [payLaterAccountId, setPayLaterAccountId] = useState<string | null>(null);
  
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const bottomSheetRef = useRef<BottomSheetModal>(null);

  useEffect(() => {
    if (visible) {
      bottomSheetRef.current?.present();
    } else {
      bottomSheetRef.current?.dismiss();
    }
  }, [visible]);

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.6}
      />
    ),
    []
  );

  const GlassBackground = useCallback(
    ({ style }: { style?: any }) => (
      <GlassCard 
        style={[style, { borderBottomLeftRadius: 0, borderBottomRightRadius: 0, overflow: 'hidden' }]} 
        glassStyle="regular" 
      />
    ),
    []
  );

  useEffect(() => {
    if (visible && user) {
      loadDependencies();
    } else {
      resetForm();
    }
  }, [visible, user, initialAccountId]);

  // Handle auto-selection of category when type changes
  useEffect(() => {
    if (type !== 'transfer' && categories.length > 0) {
      const matchingCats = categories.filter(c => c.type === type || c.type === 'both');
      if (matchingCats.length > 0) {
        setSelectedCategoryId(matchingCats[0].id);
      } else {
        setSelectedCategoryId(null);
      }
    } else {
      setSelectedCategoryId(null);
    }
  }, [type, categories]);

  // Exclude source account from destination selection automatically
  useEffect(() => {
    if (selectedAccountId && transferToAccountId === selectedAccountId) {
      const otherAcc = accounts.find(a => a.id !== selectedAccountId);
      setTransferToAccountId(otherAcc ? otherAcc.id : null);
    }
  }, [selectedAccountId, accounts]);

  const resetForm = () => {
    setType('expense');
    setAmount(null);
    setDescription('');
    setDate(new Date());
    setTransferToAccountId(null);
    setIsPayLater(false);
    setErrorMsg('');
    setIsLoading(false);
  };

  const loadDependencies = async () => {
    try {
      if (!user) return;
      const [accRes, catRes] = await Promise.all([
        getSupabase().from('accounts').select('id, name, balance, type').eq('user_id', user.id),
        getSupabase().from('categories').select('id, name, type').eq('user_id', user.id)
      ]);

      if (accRes.error) throw accRes.error;
      if (catRes.error) throw catRes.error;

      const loadedAccounts = accRes.data || [];
      setAccounts(loadedAccounts);
      setCategories(catRes.data || []);

      const creditAccounts = loadedAccounts.filter(a => a.type === 'credit_card');
      const nonCreditAccounts = loadedAccounts.filter(a => a.type !== 'credit_card');

      const preferredAcc = initialAccountId ? loadedAccounts.find(a => a.id === initialAccountId) : null;

      if (preferredAcc && preferredAcc.type === 'credit_card') {
        setType('transfer');
        setTransferToAccountId(preferredAcc.id);
        
        const defaultSource = nonCreditAccounts.length > 0 ? nonCreditAccounts[0].id : (loadedAccounts.find(a => a.id !== preferredAcc.id)?.id || null);
        setSelectedAccountId(defaultSource);
      } else {
        if (loadedAccounts.length > 0) {
          const defaultId = (initialAccountId && loadedAccounts.some(a => a.id === initialAccountId))
            ? initialAccountId
            : (selectedAccountId && loadedAccounts.some(a => a.id === selectedAccountId))
              ? selectedAccountId
              : nonCreditAccounts.length > 0 ? nonCreditAccounts[0].id : loadedAccounts[0].id;
          
          setSelectedAccountId(defaultId);
          
          const otherAccounts = loadedAccounts.filter(a => a.id !== defaultId);
          if (otherAccounts.length > 0) {
            setTransferToAccountId(otherAccounts[0].id);
          } else {
            setTransferToAccountId(null);
          }
        }
      }

      if (creditAccounts.length > 0) {
        setPayLaterAccountId(creditAccounts[0].id);
      } else {
        setPayLaterAccountId(null);
      }
    } catch (err: any) {
      setErrorMsg("Failed to load accounts/categories.");
    }
  };

  const handleSubmit = async () => {
    if (isLoading) return;
    if (!user) return;
    setErrorMsg('');

    // Validation
    const numericAmount = amount || 0;
    if (numericAmount <= 0) {
      setErrorMsg("Amount must be greater than zero.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    if (numericAmount > 100000000) {
      setErrorMsg("Amount exceeds maximum limit.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    const effectiveAccountId = (type === 'expense' && isPayLater) ? payLaterAccountId : selectedAccountId;

    if (!effectiveAccountId) {
      setErrorMsg("Please select a source account.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    if (type !== 'transfer' && !selectedCategoryId) {
      setErrorMsg("Please select a category.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    if (type === 'transfer') {
      if (!transferToAccountId) {
        setErrorMsg("Please select a destination account.");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        return;
      }
      if (effectiveAccountId === transferToAccountId) {
        setErrorMsg("Source and destination accounts must be different.");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        return;
      }
    }

    setIsLoading(true);
    
    try {
      const localDateWithOffset = toLocalISOWithOffset(date);

      if (type === 'transfer') {
        // Execute Atomic Transfer RPC
        const { error: rpcError } = await getSupabase().rpc('add_transfer_atomic', {
          p_user_id: user?.id,
          p_amount: numericAmount,
          p_description: description.trim() || 'Transfer',
          p_date: localDateWithOffset,
          p_account_id: effectiveAccountId,
          p_transfer_to_account_id: transferToAccountId
        });

        if (rpcError) throw rpcError;
      } else {
        // Execute Atomic Transaction RPC (income/expense)
        const { error: rpcError } = await getSupabase().rpc('add_transaction_atomic', {
          p_user_id: user?.id,
          p_amount: numericAmount,
          p_type: type,
          p_description: description.trim(),
          p_date: localDateWithOffset,
          p_account_id: effectiveAccountId,
          p_category_id: selectedCategoryId
        });

        if (rpcError) throw rpcError;
      }

      // Success
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      DeviceEventEmitter.emit(EVENTS.TRANSACTION_ADDED);
      DeviceEventEmitter.emit(EVENTS.ACCOUNT_UPDATED); // Tell accounts to reload
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to save transaction. Check your connection.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredCategories = categories.filter(c => c.type === type || c.type === 'both');
  const destinationAccounts = accounts.filter(a => a.id !== selectedAccountId);

  const getTypeThemeColor = () => {
    if (type === 'expense') return '#ef4444';
    if (type === 'income') return colors.primary;
    return '#3b82f6';
  };

  return (
    <BottomSheetModal
      ref={bottomSheetRef}
      index={0}
      snapPoints={['85%', '98%']}
      backdropComponent={renderBackdrop}
      backgroundComponent={GlassBackground}
      onDismiss={onClose}
      enablePanDownToClose={!isLoading}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      handleIndicatorStyle={{ backgroundColor: colors.border, width: 40 }}
      handleStyle={{ borderTopLeftRadius: 24, borderTopRightRadius: 24 }}
    >
      <BottomSheetScrollView 
        showsVerticalScrollIndicator={false} 
        contentContainerStyle={{ padding: 24, paddingBottom: Math.max(40, insets.bottom + 16) }}
      >
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>Add Transaction</Text>
          <TouchableOpacity onPress={isLoading ? undefined : onClose} style={styles.closeBtn} disabled={isLoading}>
            <X color={isLoading ? colors.border : colors.textMuted} size={24} />
          </TouchableOpacity>
        </View>

        {errorMsg ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{errorMsg}</Text>
          </View>
        ) : null}

        {/* Type Selector (3 Tabs) */}
        <View style={styles.typeToggle}>
          <TouchableOpacity 
            style={[styles.typeBtn, type === 'expense' ? { backgroundColor: '#ef4444' } : undefined]}
            onPress={() => {
              Haptics.selectionAsync();
              setType('expense');
            }}
          >
            <Text style={[styles.typeText, { color: type === 'expense' ? '#fff' : colors.textMuted }]}>Expense</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.typeBtn, type === 'income' ? { backgroundColor: colors.primary } : undefined]}
            onPress={() => {
              Haptics.selectionAsync();
              setType('income');
            }}
          >
            <Text style={[styles.typeText, { color: type === 'income' ? '#fff' : colors.textMuted }]}>Income</Text>
          </TouchableOpacity>
          {accounts.length >= 2 && (
            <TouchableOpacity 
              style={[styles.typeBtn, type === 'transfer' ? { backgroundColor: '#3b82f6' } : undefined]}
              onPress={() => {
                Haptics.selectionAsync();
                setType('transfer');
              }}
            >
              <Text style={[styles.typeText, { color: type === 'transfer' ? '#fff' : colors.textMuted }]}>Transfer</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Amount Input */}
        <View style={[styles.inputGroup, { borderBottomColor: colors.border }]}>
          <Text style={[styles.label, { color: colors.textMuted }]}>Amount (PHP)</Text>
          <CurrencyInput
            style={[styles.input, { color: getTypeThemeColor() }]}
            value={amount}
            onChangeValue={(val) => setAmount(val)}
            prefix=""
            delimiter=","
            separator="."
            precision={2}
            placeholder="0.00"
            placeholderTextColor={colors.textMuted}
            keyboardType="decimal-pad"
          />
        </View>

        {/* Description Input */}
        <View style={[styles.inputGroup, { borderBottomColor: colors.border }]}>
          <Text style={[styles.label, { color: colors.textMuted }]}>Description</Text>
          <TextInput
            style={[styles.input, { color: colors.text, fontSize: 16 }]}
            placeholder={type === 'transfer' ? 'Transfer between accounts' : 'What was this for?'}
            placeholderTextColor={colors.textMuted}
            value={description}
            onChangeText={setDescription}
          />
        </View>

        {/* Pay Later Toggle */}
        {type === 'expense' && accounts.some(a => a.type === 'credit_card') && (
          <View style={[styles.inputGroup, { borderBottomColor: colors.border, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 }]}>
            <View style={{ flex: 1, paddingRight: 16 }}>
               <Text style={{ color: colors.text, fontFamily: 'BricolageGrotesque_700Bold', fontSize: 16 }}>Pay Later (Debt)</Text>
               <Text style={{ color: colors.textMuted, fontSize: 12, fontFamily: 'Manrope_400Regular', marginTop: 2 }}>
                 Charge this expense to a credit card or debt account
               </Text>
            </View>
            <TouchableOpacity 
              onPress={() => {
                Haptics.selectionAsync();
                const nextVal = !isPayLater;
                setIsPayLater(nextVal);
                if (nextVal) {
                  const firstCredit = accounts.find(a => a.type === 'credit_card');
                  if (firstCredit) setPayLaterAccountId(firstCredit.id);
                } else {
                  const firstNonCredit = accounts.find(a => a.type !== 'credit_card');
                  if (firstNonCredit) setSelectedAccountId(firstNonCredit.id);
                }
              }}
              style={{
                width: 50,
                height: 30,
                borderRadius: 15,
                backgroundColor: isPayLater ? '#ef4444' : colors.border,
                justifyContent: 'center',
                paddingHorizontal: 2
              }}
            >
              <View style={{
                width: 26,
                height: 26,
                borderRadius: 13,
                backgroundColor: '#fff',
                alignSelf: isPayLater ? 'flex-end' : 'flex-start',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.2,
                shadowRadius: 2,
                elevation: 2
              }} />
            </TouchableOpacity>
          </View>
        )}

        {/* Source Account Selection */}
        <View style={[styles.inputGroup, { borderBottomColor: colors.border }]}>
          <Text style={[styles.label, { color: colors.textMuted }]}>
            {type === 'transfer' ? 'From Account' : 'Account'}
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillScroll}>
            {accounts
              .filter(acc => {
                if (type === 'expense') {
                  return isPayLater ? acc.type === 'credit_card' : acc.type !== 'credit_card';
                }
                return true;
              })
              .map(acc => {
                const activeId = (type === 'expense' && isPayLater) ? payLaterAccountId : selectedAccountId;
                const isSelected = activeId === acc.id;
                return (
                  <TouchableOpacity 
                    key={acc.id} 
                    onPress={() => {
                      Haptics.selectionAsync();
                      if (type === 'expense' && isPayLater) {
                        setPayLaterAccountId(acc.id);
                      } else {
                        setSelectedAccountId(acc.id);
                      }
                    }}
                    style={[styles.pill, { borderColor: colors.border, backgroundColor: isSelected ? getTypeThemeColor() : 'transparent' }]}
                  >
                    <Text style={{ color: isSelected ? '#fff' : colors.text, fontFamily: 'Manrope_500Medium' }}>{acc.name}</Text>
                  </TouchableOpacity>
                );
              })}
          </ScrollView>
        </View>

        {/* Destination Account Selection (only for transfers) */}
        {type === 'transfer' && (
          <View style={[styles.inputGroup, { borderBottomColor: colors.border }]}>
            <Text style={[styles.label, { color: colors.textMuted }]}>To Account</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillScroll}>
              {destinationAccounts.map(acc => (
                <TouchableOpacity 
                  key={acc.id} 
                  onPress={() => {
                    Haptics.selectionAsync();
                    setTransferToAccountId(acc.id);
                  }}
                  style={[styles.pill, { borderColor: colors.border, backgroundColor: transferToAccountId === acc.id ? '#3b82f6' : 'transparent' }]}
                >
                  <Text style={{ color: transferToAccountId === acc.id ? '#fff' : colors.text, fontFamily: 'Manrope_500Medium' }}>{acc.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            {destinationAccounts.length === 0 && (
              <Text style={{ color: colors.textMuted, fontSize: 12, fontFamily: 'Manrope_400Regular', marginTop: 4 }}>
                Create another account to enable transfers.
              </Text>
            )}
          </View>
        )}

        {/* Category Selection (only for income/expense) */}
        {type !== 'transfer' && (
          <View style={[styles.inputGroup, { borderBottomColor: colors.border }]}>
            <Text style={[styles.label, { color: colors.textMuted }]}>Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillScroll}>
              {filteredCategories.map(cat => (
                <TouchableOpacity 
                  key={cat.id} 
                  onPress={() => {
                    Haptics.selectionAsync();
                    setSelectedCategoryId(cat.id);
                  }}
                  style={[styles.pill, { borderColor: colors.border, backgroundColor: selectedCategoryId === cat.id ? getTypeThemeColor() : 'transparent' }]}
                >
                  <Text style={{ color: selectedCategoryId === cat.id ? '#fff' : colors.text, fontFamily: 'Manrope_500Medium' }}>{cat.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Date Selection */}
        <View style={[styles.inputGroup, { borderBottomColor: colors.border, borderBottomWidth: 0 }]}>
          <Text style={[styles.label, { color: colors.textMuted }]}>Date</Text>
          <TouchableOpacity onPress={() => setShowDatePicker(true)}>
            <Text style={{ color: colors.text, fontFamily: 'Manrope_500Medium', fontSize: 16, paddingVertical: 8 }}>
              {date.toLocaleDateString()}
            </Text>
          </TouchableOpacity>
          {showDatePicker && (
            <DateTimePicker
              value={date}
              mode="date"
              display="default"
              onChange={(event, selectedDate) => {
                setShowDatePicker(false);
                if (selectedDate) setDate(selectedDate);
              }}
            />
          )}
        </View>

        {/* Submit Button */}
        <TouchableOpacity 
          style={[styles.submitBtn, { backgroundColor: getTypeThemeColor(), opacity: isLoading ? 0.7 : 1 }]} 
          onPress={handleSubmit}
          disabled={isLoading}
        >
          {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Save Transaction</Text>}
        </TouchableOpacity>
        
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
};

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  title: { fontFamily: 'BricolageGrotesque_700Bold', fontSize: 24 },
  closeBtn: { padding: 4 },
  errorBox: { backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: 12, borderRadius: 8, marginBottom: 16 },
  errorText: { color: '#ef4444', fontFamily: 'Manrope_500Medium', textAlign: 'center' },
  typeToggle: { flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 12, padding: 4, marginBottom: 24 },
  typeBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  typeText: { fontFamily: 'Manrope_500Medium', fontSize: 16 },
  inputGroup: { borderBottomWidth: 1, paddingBottom: 16, marginBottom: 16 },
  label: { fontFamily: 'Manrope_400Regular', fontSize: 12, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 },
  input: { fontFamily: 'BricolageGrotesque_700Bold', fontSize: 32, padding: 0 },
  pillScroll: { flexDirection: 'row' },
  pill: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999, borderWidth: 1, marginRight: 8, marginVertical: 4 },
  submitBtn: { padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 16 },
  submitText: { fontFamily: 'BricolageGrotesque_700Bold', color: '#fff', fontSize: 18 }
});
