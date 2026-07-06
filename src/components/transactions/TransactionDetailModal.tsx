import React, { useState, useEffect } from 'react';
import { Modal, View, Text, TouchableOpacity, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform, StyleSheet, ScrollView, DeviceEventEmitter, Alert } from 'react-native';
import { GlassCard } from '../ui/GlassCard';
import { useTheme } from '../../theme/ThemeProvider';
import { getSupabase } from '../../../lib/supabase';
import { useSession } from '../../app/_layout';
import DateTimePicker from '@react-native-community/datetimepicker';
import { X, Calendar, Tag, Wallet, FileText, Trash2, Edit2, Check, ArrowDownLeft, ArrowUpRight, ArrowLeftRight } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { EVENTS } from '../../lib/events';

interface Props {
  visible: boolean;
  onClose: () => void;
  transaction: any;
}

export const TransactionDetailModal: React.FC<Props> = ({ visible, onClose, transaction }) => {
  const { colors } = useTheme();
  const { user } = useSession();
  const [isEditing, setIsEditing] = useState(false);
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date());
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  
  const [categories, setCategories] = useState<any[]>([]);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (visible && transaction) {
      setDescription(transaction.description || '');
      setDate(transaction.date ? new Date(transaction.date) : new Date());
      setSelectedCategoryId(transaction.category_id || transaction.category?.id || null);
      setIsEditing(false);
      setErrorMsg('');
      if (user) {
        loadCategories();
      }
    }
  }, [visible, transaction, user]);

  const loadCategories = async () => {
    try {
      if (!user) return;
      const { data, error } = await getSupabase()
        .from('categories')
        .select('id, name, type')
        .eq('user_id', user.id);

      if (error) throw error;
      setCategories(data || []);
    } catch (err) {
      console.error("Failed to load categories in detail modal", err);
    }
  };

  const handleUpdate = async () => {
    if (isLoading || !user || !transaction) return;
    setIsLoading(true);
    setErrorMsg('');

    try {
      // Timezone-safe offset calculation to prevent UTC boundaries drift
      const offset = -date.getTimezoneOffset();
      const absOffset = Math.abs(offset);
      const sign = offset >= 0 ? '+' : '-';
      const pad = (num: number) => String(Math.floor(num)).padStart(2, '0');
      
      const hoursOffset = pad(Math.floor(absOffset / 60));
      const minsOffset = pad(absOffset % 60);
      const tzString = `${sign}${hoursOffset}:${minsOffset}`;
      
      const year = date.getFullYear();
      const month = pad(date.getMonth() + 1);
      const day = pad(date.getDate());
      const hours = pad(date.getHours());
      const minutes = pad(date.getMinutes());
      const seconds = pad(date.getSeconds());
      
      const localDateWithOffset = `${year}-${month}-${day}T${hours}:${minutes}:${seconds}${tzString}`;

      const { error } = await getSupabase()
        .from('transactions')
        .update({
          description: description.trim(),
          date: localDateWithOffset,
          category_id: selectedCategoryId
        })
        .eq('id', transaction.id)
        .eq('user_id', user.id);

      if (error) throw error;

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      DeviceEventEmitter.emit(EVENTS.TRANSACTION_ADDED); // Refresh UI lists
      setIsEditing(false);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to update transaction.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (isLoading || !user || !transaction) return;

    Alert.alert(
      "Delete Transaction",
      "Are you sure you want to delete this transaction? The account balance will be atomically reverted.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setIsLoading(true);
            setErrorMsg('');
            try {
              const { error } = await getSupabase().rpc('delete_transaction_atomic', {
                p_transaction_id: transaction.id,
                p_user_id: user.id
              });

              if (error) throw error;

              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              DeviceEventEmitter.emit(EVENTS.TRANSACTION_ADDED);
              DeviceEventEmitter.emit(EVENTS.ACCOUNT_UPDATED);
              onClose();
            } catch (err: any) {
              setErrorMsg(err.message || "Failed to delete transaction.");
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            } finally {
              setIsLoading(false);
            }
          }
        }
      ]
    );
  };

  if (!transaction) return null;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
    }).format(amount);
  };

  const getTypeColor = () => {
    switch (transaction.type) {
      case "income": return colors.primary;
      case "expense": return "#ef4444";
      case "transfer": return "#3b82f6";
      default: return colors.textMuted;
    }
  };

  const getIcon = () => {
    const color = getTypeColor();
    switch (transaction.type) {
      case "income": return <ArrowDownLeft color={color} size={32} />;
      case "expense": return <ArrowUpRight color={color} size={32} />;
      case "transfer": return <ArrowLeftRight color={color} size={32} />;
      default: return <FileText color={color} size={32} />;
    }
  };

  const filteredCategories = categories.filter(c => c.type === transaction.type || c.type === 'both');

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={isLoading ? () => {} : onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={isLoading ? undefined : onClose} disabled={isLoading} />
        
        <View style={styles.sheetContainer}>
          <GlassCard style={styles.sheet} glassStyle="regular">
            <View style={styles.header}>
              <Text style={[styles.title, { color: colors.text }]}>
                {isEditing ? 'Edit Transaction' : 'Transaction Details'}
              </Text>
              <TouchableOpacity onPress={isLoading ? undefined : onClose} style={styles.closeBtn} disabled={isLoading}>
                <X color={isLoading ? colors.border : colors.textMuted} size={24} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {errorMsg ? (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{errorMsg}</Text>
                </View>
              ) : null}

              {/* Amount Display Header */}
              <View style={[styles.amountHeader, { backgroundColor: 'rgba(0,0,0,0.1)' }]}>
                <View style={[styles.iconContainer, { backgroundColor: 'rgba(255,255,255,0.05)' }]}>
                  {getIcon()}
                </View>
                <Text style={[styles.typeText, { color: colors.textMuted }]}>{transaction.type.toUpperCase()}</Text>
                <Text style={[styles.amountText, { color: getTypeColor() }]}>
                  {transaction.type === "income" ? "+" : transaction.type === "expense" ? "-" : ""}
                  {formatCurrency(Number(transaction.amount))}
                </Text>
              </View>

              {/* Locked Fields Notice inside Edit Mode */}
              {isEditing && (
                <View style={styles.alertBox}>
                  <Text style={[styles.alertText, { color: colors.textMuted }]}>
                    Locked fields (Amount, Wallet, Type) cannot be modified here to ensure ledger integrity. To modify these, delete this transaction and add a new one.
                  </Text>
                </View>
              )}

              {/* Fields */}
              <View style={styles.fieldsContainer}>
                
                {/* Description */}
                <View style={[styles.fieldRow, { borderBottomColor: colors.border }]}>
                  <View style={styles.fieldLabelContainer}>
                    <FileText color={colors.textMuted} size={16} style={styles.fieldIcon} />
                    <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Description</Text>
                  </View>
                  {isEditing ? (
                    <TextInput
                      style={[styles.input, { color: colors.text, borderBottomWidth: 1, borderBottomColor: colors.border }]}
                      value={description}
                      onChangeText={setDescription}
                      placeholder="No description"
                      placeholderTextColor={colors.textMuted}
                    />
                  ) : (
                    <Text style={[styles.fieldValue, { color: colors.text }]}>
                      {transaction.description || "No description provided"}
                    </Text>
                  )}
                </View>

                {/* Wallet (Read-Only) */}
                <View style={[styles.fieldRow, { borderBottomColor: colors.border }]}>
                  <View style={styles.fieldLabelContainer}>
                    <Wallet color={colors.textMuted} size={16} style={styles.fieldIcon} />
                    <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>
                      {transaction.type === 'transfer' ? 'Source Wallet' : 'Wallet'}
                    </Text>
                  </View>
                  <Text style={[styles.fieldValue, { color: isEditing ? colors.textMuted : colors.text }]}>
                    {transaction.account?.name || "Unknown Wallet"}
                  </Text>
                </View>

                {/* Transfer Destination (Read-Only) */}
                {transaction.type === 'transfer' && (
                  <View style={[styles.fieldRow, { borderBottomColor: colors.border }]}>
                    <View style={styles.fieldLabelContainer}>
                      <ArrowLeftRight color={colors.textMuted} size={16} style={styles.fieldIcon} />
                      <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Destination Wallet</Text>
                    </View>
                    <Text style={[styles.fieldValue, { color: isEditing ? colors.textMuted : colors.text }]}>
                      {transaction.transfer_to_account?.name || "Unknown Wallet"}
                    </Text>
                  </View>
                )}

                {/* Category (Mutable for Income/Expense) */}
                {transaction.type !== 'transfer' && (
                  <View style={[styles.fieldRow, { borderBottomColor: colors.border }]}>
                    <View style={styles.fieldLabelContainer}>
                      <Tag color={colors.textMuted} size={16} style={styles.fieldIcon} />
                      <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Category</Text>
                    </View>
                    {isEditing ? (
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
                    ) : (
                      <Text style={[styles.fieldValue, { color: colors.text }]}>
                        {transaction.category?.name || "No Category"}
                      </Text>
                    )}
                  </View>
                )}

                {/* Date */}
                <View style={[styles.fieldRow, { borderBottomColor: colors.border, borderBottomWidth: 0 }]}>
                  <View style={styles.fieldLabelContainer}>
                    <Calendar color={colors.textMuted} size={16} style={styles.fieldIcon} />
                    <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Date</Text>
                  </View>
                  {isEditing ? (
                    <View>
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
                  ) : (
                    <Text style={[styles.fieldValue, { color: colors.text }]}>
                      {new Date(transaction.date).toLocaleDateString(undefined, { dateStyle: 'long' })}
                    </Text>
                  )}
                </View>

              </View>

              {/* Action Buttons */}
              <View style={styles.actionRow}>
                {isEditing ? (
                  <>
                    <TouchableOpacity 
                      style={[styles.actionBtn, { borderColor: colors.border, borderWidth: 1 }]} 
                      onPress={() => setIsEditing(false)}
                      disabled={isLoading}
                    >
                      <Text style={{ color: colors.text, fontFamily: 'BricolageGrotesque_700Bold' }}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={[styles.actionBtn, { backgroundColor: colors.primary }]} 
                      onPress={handleUpdate}
                      disabled={isLoading}
                    >
                      {isLoading ? <ActivityIndicator color="#fff" /> : (
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <Check color="#fff" size={16} style={{ marginRight: 6 }} />
                          <Text style={{ color: '#fff', fontFamily: 'BricolageGrotesque_700Bold' }}>Save</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    <TouchableOpacity 
                      style={[styles.actionBtn, { backgroundColor: 'rgba(239, 68, 68, 0.1)', borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.3)' }]} 
                      onPress={handleDelete}
                      disabled={isLoading}
                    >
                      <Trash2 color="#ef4444" size={18} style={{ marginRight: 6 }} />
                      <Text style={{ color: '#ef4444', fontFamily: 'BricolageGrotesque_700Bold' }}>Delete</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={[styles.actionBtn, { backgroundColor: colors.primary }]} 
                      onPress={() => setIsEditing(true)}
                      disabled={isLoading}
                    >
                      <Edit2 color="#fff" size={18} style={{ marginRight: 6 }} />
                      <Text style={{ color: '#fff', fontFamily: 'BricolageGrotesque_700Bold' }}>Edit</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>

            </ScrollView>
          </GlassCard>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)' },
  sheetContainer: { width: '100%', maxHeight: '90%' },
  sheet: { borderBottomLeftRadius: 0, borderBottomRightRadius: 0, padding: 24, paddingBottom: 40 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title: { fontFamily: 'BricolageGrotesque_700Bold', fontSize: 24 },
  closeBtn: { padding: 4 },
  errorBox: { backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: 12, borderRadius: 8, marginBottom: 16 },
  errorText: { color: '#ef4444', fontFamily: 'Manrope_500Medium', textAlign: 'center' },
  amountHeader: { alignItems: 'center', justifyContent: 'center', padding: 24, borderRadius: 16, marginBottom: 20 },
  iconContainer: { padding: 12, borderRadius: 999, marginBottom: 8 },
  typeText: { fontFamily: 'Manrope_500Medium', fontSize: 12, letterSpacing: 1, marginBottom: 4 },
  amountText: { fontFamily: 'BricolageGrotesque_700Bold', fontSize: 32 },
  alertBox: { backgroundColor: 'rgba(255,255,255,0.05)', padding: 12, borderRadius: 12, marginBottom: 20 },
  alertText: { fontFamily: 'Manrope_400Regular', fontSize: 12, lineHeight: 18 },
  fieldsContainer: { marginBottom: 24 },
  fieldRow: { borderBottomWidth: 1, paddingVertical: 12, gap: 4 },
  fieldLabelContainer: { flexDirection: 'row', alignItems: 'center' },
  fieldIcon: { marginRight: 6 },
  fieldLabel: { fontFamily: 'Manrope_500Medium', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  fieldValue: { fontFamily: 'Manrope_500Medium', fontSize: 16, marginTop: 4 },
  input: { fontFamily: 'Manrope_500Medium', fontSize: 16, padding: 4, marginTop: 4 },
  pillWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  pill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1 },
  actionRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  actionBtn: { flex: 1, padding: 16, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' }
});
