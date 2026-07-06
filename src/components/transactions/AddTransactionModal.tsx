import React, { useState, useEffect } from 'react';
import { Modal, View, Text, TouchableOpacity, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform, StyleSheet, ScrollView, DeviceEventEmitter } from 'react-native';
import { GlassCard } from '../ui/GlassCard';
import { useTheme } from '../../theme/ThemeProvider';
import { getSupabase } from '../../../lib/supabase';
import { useSession } from '../../app/_layout';
import DateTimePicker from '@react-native-community/datetimepicker';
import { X } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { EVENTS } from '../../../lib/events';

interface Props {
  visible: boolean;
  onClose: () => void;
}

export const AddTransactionModal: React.FC<Props> = ({ visible, onClose }) => {
  const { colors, isDark } = useTheme();
  const { user } = useSession();

  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  
  const [accounts, setAccounts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (visible && user) {
      loadDependencies();
    } else {
      resetForm();
    }
  }, [visible, user]);

  const resetForm = () => {
    setType('expense');
    setAmount('');
    setDescription('');
    setDate(new Date());
    setErrorMsg('');
    setIsLoading(false);
  };

  const loadDependencies = async () => {
    try {
      if (!user) return;
      const [accRes, catRes] = await Promise.all([
        getSupabase().from('accounts').select('id, name, balance').eq('user_id', user.id),
        getSupabase().from('categories').select('id, name, type').eq('user_id', user.id)
      ]);

      if (accRes.error) throw accRes.error;
      if (catRes.error) throw catRes.error;

      setAccounts(accRes.data || []);
      setCategories(catRes.data || []);
      
      if (accRes.data && accRes.data.length > 0 && !selectedAccountId) {
        setSelectedAccountId(accRes.data[0].id);
      }
    } catch (err: any) {
      setErrorMsg("Failed to load accounts/categories.");
    }
  };

  const handleSubmit = async () => {
    if (isLoading) return; // Mutex
    setErrorMsg('');

    // Validation
    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      setErrorMsg("Amount must be greater than zero.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    if (numericAmount > 100000000) {
      setErrorMsg("Amount exceeds maximum limit.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    if (!selectedAccountId || !selectedCategoryId) {
      setErrorMsg("Please select an account and category.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    setIsLoading(true);
    
    try {
      const localDateString = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}`;

      const { error } = await getSupabase().from('transactions').insert({
        user_id: user?.id,
        amount: numericAmount,
        type,
        description: description.trim(),
        date: localDateString,
        account_id: selectedAccountId,
        category_id: selectedCategoryId
      });

      if (error) throw error;

      const selectedAccount = accounts.find(a => a.id === selectedAccountId);
      if (selectedAccount) {
        const newBalance = type === 'expense' 
          ? Number(selectedAccount.balance) - numericAmount
          : Number(selectedAccount.balance) + numericAmount;
          
        const { error: accError } = await getSupabase()
          .from('accounts')
          .update({ balance: newBalance })
          .eq('id', selectedAccountId);
          
        if (accError) throw accError;
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      DeviceEventEmitter.emit(EVENTS.TRANSACTION_ADDED);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to add transaction. Check your connection.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredCategories = categories.filter(c => c.type === type || c.type === 'both');

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
        
        <View style={styles.sheetContainer}>
          <GlassCard style={styles.sheet} glassStyle="regular">
            <View style={styles.header}>
              <Text style={[styles.title, { color: colors.text }]}>Add Transaction</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <X color={colors.textMuted} size={24} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {errorMsg ? (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{errorMsg}</Text>
                </View>
              ) : null}

              {/* Type Selector */}
              <View style={styles.typeToggle}>
                <TouchableOpacity 
                  style={[styles.typeBtn, type === 'expense' ? { backgroundColor: '#ef4444' } : undefined]}
                  onPress={() => setType('expense')}
                >
                  <Text style={[styles.typeText, { color: type === 'expense' ? '#fff' : colors.textMuted }]}>Expense</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.typeBtn, type === 'income' ? { backgroundColor: '#10b981' } : undefined]}
                  onPress={() => setType('income')}
                >
                  <Text style={[styles.typeText, { color: type === 'income' ? '#fff' : colors.textMuted }]}>Income</Text>
                </TouchableOpacity>
              </View>

              {/* Amount Input */}
              <View style={[styles.inputGroup, { borderBottomColor: colors.border }]}>
                <Text style={[styles.label, { color: colors.textMuted }]}>Amount (PHP)</Text>
                <TextInput
                  style={[styles.input, { color: type === 'income' ? '#10b981' : '#ef4444' }]}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  placeholderTextColor={colors.textMuted}
                  value={amount}
                  onChangeText={setAmount}
                />
              </View>

              {/* Description Input */}
              <View style={[styles.inputGroup, { borderBottomColor: colors.border }]}>
                <Text style={[styles.label, { color: colors.textMuted }]}>Description</Text>
                <TextInput
                  style={[styles.input, { color: colors.text, fontSize: 16 }]}
                  placeholder="What was this for?"
                  placeholderTextColor={colors.textMuted}
                  value={description}
                  onChangeText={setDescription}
                />
              </View>

              {/* Account Selection */}
              <View style={[styles.inputGroup, { borderBottomColor: colors.border }]}>
                <Text style={[styles.label, { color: colors.textMuted }]}>Account</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillScroll}>
                  {accounts.map(acc => (
                    <TouchableOpacity 
                      key={acc.id} 
                      onPress={() => setSelectedAccountId(acc.id)}
                      style={[styles.pill, { borderColor: colors.border, backgroundColor: selectedAccountId === acc.id ? colors.primary : 'transparent' }]}
                    >
                      <Text style={{ color: selectedAccountId === acc.id ? '#fff' : colors.text, fontFamily: 'Manrope_500Medium' }}>{acc.name}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* Category Selection */}
              <View style={[styles.inputGroup, { borderBottomColor: colors.border }]}>
                <Text style={[styles.label, { color: colors.textMuted }]}>Category</Text>
                <View style={styles.pillWrap}>
                  {filteredCategories.map(cat => (
                    <TouchableOpacity 
                      key={cat.id} 
                      onPress={() => setSelectedCategoryId(cat.id)}
                      style={[styles.pill, { borderColor: colors.border, backgroundColor: selectedCategoryId === cat.id ? colors.primary : 'transparent' }]}
                    >
                      <Text style={{ color: selectedCategoryId === cat.id ? '#fff' : colors.text, fontFamily: 'Manrope_500Medium' }}>{cat.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

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
                style={[styles.submitBtn, { backgroundColor: colors.primary, opacity: isLoading ? 0.7 : 1 }]} 
                onPress={handleSubmit}
                disabled={isLoading}
              >
                {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Save Transaction</Text>}
              </TouchableOpacity>
              
            </ScrollView>
          </GlassCard>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheetContainer: { width: '100%', maxHeight: '90%' },
  sheet: { borderBottomLeftRadius: 0, borderBottomRightRadius: 0, padding: 24, paddingBottom: 40 },
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
  pillWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999, borderWidth: 1, marginRight: 8 },
  submitBtn: { padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 16 },
  submitText: { fontFamily: 'BricolageGrotesque_700Bold', color: '#fff', fontSize: 18 }
});
