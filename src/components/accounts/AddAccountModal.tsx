import React, { useState, useEffect } from 'react';
import { Modal, View, Text, TouchableOpacity, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform, StyleSheet, ScrollView, DeviceEventEmitter, Alert } from 'react-native';
import { GlassCard } from '../ui/GlassCard';
import { useTheme } from '../../theme/ThemeProvider';
import { getSupabase } from '../../../lib/supabase';
import { useSession } from '../../app/_layout';
import { X, Wallet, Landmark, CreditCard, Building2, TrendingUp, PiggyBank } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { EVENTS } from '../../lib/events';

export interface AccountData {
  id?: string;
  name: string;
  type: string;
  balance: number;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  initialData?: AccountData | null;
}

const ACCOUNT_TYPES = [
  { id: 'cash', label: 'Cash', icon: Wallet },
  { id: 'bank', label: 'Bank', icon: Landmark },
  { id: 'credit_card', label: 'PayLater / Debt', icon: CreditCard },
  { id: 'e_wallet', label: 'E-Wallet', icon: Building2 },
  { id: 'investment', label: 'Investment', icon: TrendingUp },
];

export const AddAccountModal: React.FC<Props> = ({ visible, onClose, initialData }) => {
  const { colors } = useTheme();
  const { user } = useSession();

  const [name, setName] = useState('');
  const [type, setType] = useState('cash');
  const [balance, setBalance] = useState('');
  
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const isEditMode = !!initialData;

  useEffect(() => {
    if (visible) {
      if (initialData) {
        setName(initialData.name);
        setType(initialData.type);
        setBalance(initialData.balance.toString());
      } else {
        resetForm();
      }
    }
  }, [visible, initialData]);

  const resetForm = () => {
    setName('');
    setType('cash');
    setBalance('');
    setErrorMsg('');
    setIsLoading(false);
  };

  const handleSubmit = async () => {
    if (isLoading) return;
    if (!user) return;
    setErrorMsg('');

    const trimmedName = name.trim();
    if (!trimmedName) {
      setErrorMsg("Please enter an account name.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    let numericBalance = 0;
    if (!isEditMode) {
      numericBalance = Number(parseFloat(balance).toFixed(2));
      if (isNaN(numericBalance)) {
        setErrorMsg("Please enter a valid initial balance.");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        return;
      }
    }

    setIsLoading(true);
    
    try {
      if (isEditMode && initialData?.id) {
        // Edit Mode - NEVER update balance
        const { error } = await getSupabase()
          .from('accounts')
          .update({ name: trimmedName, type })
          .eq('id', initialData.id)
          .eq('user_id', user.id);
          
        if (error) throw error;
      } else {
        // Create Mode - Safe to set initial balance
        const { error } = await getSupabase()
          .from('accounts')
          .insert({
            user_id: user.id,
            name: trimmedName,
            type,
            balance: numericBalance,
            include_in_networth: true
          });
          
        if (error) throw error;
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      DeviceEventEmitter.emit(EVENTS.ACCOUNT_ADDED);
      DeviceEventEmitter.emit(EVENTS.TRANSACTION_ADDED); // Refresh dashboard too
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to save account.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={isLoading ? () => {} : onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={isLoading ? undefined : onClose} disabled={isLoading} />
        
        <View style={styles.sheetContainer}>
          <GlassCard style={styles.sheet} glassStyle="regular">
            <View style={styles.header}>
              <Text style={[styles.title, { color: colors.text }]}>
                {isEditMode ? 'Edit Account' : 'Add Account'}
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

              {/* Account Type Selection */}
              <View style={[styles.inputGroup, { borderBottomColor: colors.border }]}>
                <Text style={[styles.label, { color: colors.textMuted }]}>Account Type</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillScroll}>
                  {ACCOUNT_TYPES.map(accType => {
                    const isSelected = type === accType.id;
                    const Icon = accType.icon;
                    return (
                      <TouchableOpacity 
                        key={accType.id} 
                        onPress={() => setType(accType.id)}
                        style={[
                          styles.typePill, 
                          { 
                            borderColor: isSelected ? colors.primary : colors.border,
                            backgroundColor: isSelected ? 'rgba(34, 197, 94, 0.1)' : 'transparent' 
                          }
                        ]}
                      >
                        <Icon color={isSelected ? colors.primary : colors.textMuted} size={16} />
                        <Text style={{ 
                          color: isSelected ? colors.primary : colors.text, 
                          fontFamily: 'Manrope_500Medium',
                          marginLeft: 8
                        }}>
                          {accType.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              {/* Account Name */}
              <View style={[styles.inputGroup, { borderBottomColor: colors.border }]}>
                <Text style={[styles.label, { color: colors.textMuted }]}>Account Name</Text>
                <TextInput
                  style={[styles.input, { color: colors.text, fontSize: 24 }]}
                  placeholder="e.g. BDO Savings"
                  placeholderTextColor={colors.textMuted}
                  value={name}
                  onChangeText={setName}
                />
              </View>

              {/* Initial Balance */}
              <View style={[styles.inputGroup, { borderBottomColor: colors.border, borderBottomWidth: 0 }]}>
                <Text style={[styles.label, { color: colors.textMuted }]}>
                  {isEditMode ? 'Current Balance (Read Only)' : 'Initial Balance (PHP)'}
                </Text>
                <TextInput
                  style={[styles.input, { color: isEditMode ? colors.textMuted : colors.primary }]}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  placeholderTextColor={colors.textMuted}
                  value={balance}
                  onChangeText={setBalance}
                  editable={!isEditMode}
                />
                {isEditMode && (
                  <Text style={{ fontFamily: 'Manrope_400Regular', color: colors.textMuted, fontSize: 12, marginTop: 8 }}>
                    Balances can only be modified by adding transactions.
                  </Text>
                )}
              </View>

              {/* Submit Button */}
              <TouchableOpacity 
                style={[styles.submitBtn, { backgroundColor: colors.primary, opacity: isLoading ? 0.7 : 1 }]} 
                onPress={handleSubmit}
                disabled={isLoading}
              >
                {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Save Account</Text>}
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
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)' },
  sheetContainer: { width: '100%', maxHeight: '90%' },
  sheet: { borderBottomLeftRadius: 0, borderBottomRightRadius: 0, padding: 24, paddingBottom: 40 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  title: { fontFamily: 'BricolageGrotesque_700Bold', fontSize: 24 },
  closeBtn: { padding: 4 },
  errorBox: { backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: 12, borderRadius: 8, marginBottom: 16 },
  errorText: { color: '#ef4444', fontFamily: 'Manrope_500Medium', textAlign: 'center' },
  inputGroup: { borderBottomWidth: 1, paddingBottom: 16, marginBottom: 16 },
  label: { fontFamily: 'Manrope_400Regular', fontSize: 12, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 },
  input: { fontFamily: 'BricolageGrotesque_700Bold', fontSize: 32, padding: 0 },
  pillScroll: { flexDirection: 'row' },
  typePill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 999, borderWidth: 1, marginRight: 8 },
  submitBtn: { padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 16 },
  submitText: { fontFamily: 'BricolageGrotesque_700Bold', color: '#fff', fontSize: 18 }
});
