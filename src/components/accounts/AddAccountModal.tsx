import React, { useState, useEffect } from 'react';
import { Modal, View, Text, TouchableOpacity, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform, StyleSheet, ScrollView, DeviceEventEmitter, Alert, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassCard } from '../ui/GlassCard';
import { useTheme } from '../../theme/ThemeProvider';
import { getSupabase } from '../../../lib/supabase';
import { useSession } from '../../app/_layout';
import { X, Wallet, Landmark, CreditCard, Smartphone, TrendingUp, PiggyBank, Plus, Check } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { EVENTS } from '../../lib/events';
import { parseNonNegativeAmount, sanitizeColor } from '../../lib/utils';

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
  existingAccounts?: Array<{ icon: string; is_savings: boolean }>;
}

interface AccountOption {
  type: 'cash' | 'bank' | 'credit_card' | 'e_wallet' | 'investment';
  icon: string;
  name: string;
  color: string;
  isSavings: boolean;
}

const accountOptions: AccountOption[] = [
  // Wallet Category
  { type: 'e_wallet', icon: 'gcash.png', name: 'GCash', color: '#007DFE', isSavings: false },
  { type: 'e_wallet', icon: 'maya.png', name: 'Maya', color: '#10b981', isSavings: false },
  { type: 'bank', icon: 'gotyme.png', name: 'GoTyme', color: '#06b6d4', isSavings: false },
  { type: 'cash', icon: '', name: 'Cash on Hand', color: '#86efac', isSavings: false },
  // Savings Category
  { type: 'e_wallet', icon: 'gcash.png', name: 'GCash Savings', color: '#007DFE', isSavings: true },
  { type: 'e_wallet', icon: 'maya.png', name: 'Maya Savings', color: '#10b981', isSavings: true },
  { type: 'bank', icon: 'gotyme.png', name: 'GoTyme Savings', color: '#06b6d4', isSavings: true },
  { type: 'bank', icon: 'seabank.png', name: 'SeaBank Savings', color: '#FF6B00', isSavings: true },
  // PayLater / Debt
  { type: 'credit_card', icon: 'Spaylater.png', name: 'SPayLater', color: '#10b981', isSavings: false },
  { type: 'credit_card', icon: 'Metrobank.webp', name: 'Metrobank', color: '#007DFE', isSavings: false },
  { type: 'credit_card', icon: 'tiktok.png', name: 'TikTok PayLater', color: '#000000', isSavings: false },
];

const WALLET_LOGOS: Record<string, any> = {
  'GCash': require('../../../assets/images/logos/gcash.png'),
  'GCash Savings': require('../../../assets/images/logos/gcash.png'),
  'Maya': require('../../../assets/images/logos/maya.png'),
  'Maya Savings': require('../../../assets/images/logos/maya.png'),
  'GoTyme': require('../../../assets/images/logos/gotyme.png'),
  'GoTyme Savings': require('../../../assets/images/logos/gotyme.png'),
  'SeaBank Savings': require('../../../assets/images/logos/seabank.png'),
  'SPayLater': require('../../../assets/images/logos/Spaylater.png'),
  'Metrobank': require('../../../assets/images/logos/Metrobank.webp'),
  'TikTok PayLater': require('../../../assets/images/logos/tiktok.png'),
};

const CUSTOM_COLORS = [
  '#10b981', '#06b6d4', '#3b82f6', '#8b5cf6',
  '#ec4899', '#f43f5e', '#f59e0b', '#84cc16'
];

const getAccountIconFallback = (type: string, color: string) => {
  switch (type) {
    case 'cash': return <Wallet color={color} size={24} />;
    case 'bank': return <Landmark color={color} size={24} />;
    case 'credit_card': return <CreditCard color={color} size={24} />;
    case 'e_wallet': return <Smartphone color={color} size={24} />;
    case 'investment': return <TrendingUp color={color} size={24} />;
    default: return <PiggyBank color={color} size={24} />;
  }
};

export const AddAccountModal: React.FC<Props> = ({ visible, onClose, initialData, existingAccounts = [] }) => {
  const { colors } = useTheme();
  const { user } = useSession();
  const insets = useSafeAreaInsets();

  const [selectedAccount, setSelectedAccount] = useState<AccountOption | null>(null);
  const [isCreatingCustom, setIsCreatingCustom] = useState(false);
  
  // Form fields
  const [name, setName] = useState('');
  const [type, setType] = useState('cash');
  const [balance, setBalance] = useState('');
  const [interestRate, setInterestRate] = useState('');
  const [includeNetworth, setIncludeNetworth] = useState(true);
  const [customColor, setCustomColor] = useState('#10b981');
  const [customCategory, setCustomCategory] = useState<'wallet' | 'savings' | 'paylater'>('wallet');
  const [customType, setCustomType] = useState<'cash' | 'bank' | 'credit_card' | 'e_wallet'>('e_wallet');

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

  // Adjust settings depending on selected template type
  useEffect(() => {
    if (selectedAccount?.type === 'credit_card') {
      setBalance('0');
      setIncludeNetworth(false);
    }
  }, [selectedAccount]);

  const resetForm = () => {
    setSelectedAccount(null);
    setIsCreatingCustom(false);
    setName('');
    setType('cash');
    setBalance('');
    setInterestRate('');
    setIncludeNetworth(true);
    setCustomColor('#10b981');
    setCustomCategory('wallet');
    setCustomType('e_wallet');
    setErrorMsg('');
    setIsLoading(false);
  };

  const isAccountDisabled = (option: AccountOption) => {
    return existingAccounts.some(
      (acc) => option.icon && acc.icon === option.icon && acc.is_savings === option.isSavings
    );
  };

  const handleSubmit = async () => {
    if (isLoading) return;
    if (!user) return;
    setErrorMsg('');

    // Edit mode submit
    if (isEditMode && initialData?.id) {
      const trimmedName = name.trim();
      if (!trimmedName) {
        setErrorMsg('Please enter an account name.');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        return;
      }
      setIsLoading(true);
      try {
        const { error } = await getSupabase()
          .from('accounts')
          .update({ name: trimmedName, type })
          .eq('id', initialData.id)
          .eq('user_id', user.id);
          
        if (error) throw error;
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        DeviceEventEmitter.emit(EVENTS.ACCOUNT_ADDED);
        DeviceEventEmitter.emit(EVENTS.TRANSACTION_ADDED);
        onClose();
      } catch (err: any) {
        setErrorMsg(err.message || 'Failed to update wallet.');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } finally {
        setIsLoading(false);
      }
      return;
    }

    // Create mode validation
    if (!selectedAccount && !isCreatingCustom) {
      setErrorMsg('Please select a wallet type or choose Custom.');
      return;
    }

    const finalName = isCreatingCustom ? name.trim() : selectedAccount!.name;
    if (!finalName) {
      setErrorMsg('Please enter an account name.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    if (finalName.length > 60) {
      setErrorMsg('Wallet name must be 60 characters or fewer.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    const parsedBalance = parseNonNegativeAmount(balance || '0');
    if (parsedBalance === null) {
      setErrorMsg('Balance must be a non-negative amount.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    const isSavings = isCreatingCustom ? customCategory === 'savings' : selectedAccount!.isSavings;
    const isDebt = isCreatingCustom ? customCategory === 'paylater' : selectedAccount!.type === 'credit_card';

    const parsedInterest = Number(interestRate || '0');
    if (isSavings && (!Number.isFinite(parsedInterest) || parsedInterest < 0 || parsedInterest > 100)) {
      setErrorMsg('Interest rate must be between 0 and 100.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    setIsLoading(true);

    try {
      let accountData: any;

      if (isCreatingCustom) {
        const accountType = isDebt ? 'credit_card' : customType;
        accountData = {
          user_id: user.id,
          name: finalName,
          type: accountType,
          balance: parsedBalance,
          currency: 'PHP',
          color: sanitizeColor(customColor),
          icon: '',
          is_savings: isSavings,
          interest_rate: isSavings ? parsedInterest : 0,
          include_in_networth: isDebt ? false : includeNetworth,
        };
      } else {
        accountData = {
          user_id: user.id,
          name: selectedAccount!.name,
          type: selectedAccount!.type,
          balance: parsedBalance,
          currency: 'PHP',
          color: sanitizeColor(selectedAccount!.color),
          icon: selectedAccount!.icon,
          is_savings: selectedAccount!.isSavings,
          interest_rate: selectedAccount!.isSavings ? parsedInterest : 0,
          include_in_networth: isDebt ? false : includeNetworth,
        };
      }

      const { error } = await getSupabase().from('accounts').insert([accountData]);
      if (error) throw error;

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      DeviceEventEmitter.emit(EVENTS.ACCOUNT_ADDED);
      DeviceEventEmitter.emit(EVENTS.TRANSACTION_ADDED);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to add wallet.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsLoading(false);
    }
  };

  const renderOptionButton = (option: AccountOption, idx: number) => {
    const disabled = isAccountDisabled(option);
    const isSelected = selectedAccount === option;
    const hasLogo = option.name && WALLET_LOGOS[option.name];

    return (
      <TouchableOpacity
        key={idx}
        disabled={disabled}
        onPress={() => {
          setSelectedAccount(option);
          setIsCreatingCustom(false);
          setErrorMsg('');
        }}
        style={[
          styles.optionCard,
          {
            borderColor: isSelected ? option.color : colors.border,
            borderWidth: isSelected ? 2.5 : 1.5,
            opacity: disabled ? 0.25 : 1,
            backgroundColor: isSelected ? `${option.color}15` : 'rgba(255,255,255,0.01)',
          }
        ]}
      >
        <View style={[styles.iconContainer, { borderColor: isSelected ? option.color : colors.border, borderWidth: isSelected ? 2 : 1.5 }]}>
          {hasLogo ? (
            <Image source={WALLET_LOGOS[option.name]} style={styles.logoImage} resizeMode="contain" />
          ) : (
            getAccountIconFallback(option.type, option.color || colors.primary)
          )}
        </View>
        <Text style={[styles.optionLabel, { color: colors.text, fontWeight: isSelected ? '700' : '500' }]} numberOfLines={1}>
          {option.name}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={isLoading ? () => {} : onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={isLoading ? undefined : onClose} disabled={isLoading} />
        
        <View style={styles.sheetContainer}>
          <GlassCard style={[styles.sheet, { paddingBottom: Math.max(40, insets.bottom + 16) }]} glassStyle="regular">
            <View style={styles.header}>
              <Text style={[styles.title, { color: colors.text }]}>
                {isEditMode ? 'Edit Wallet' : 'Add Wallet'}
              </Text>
              <TouchableOpacity onPress={isLoading ? undefined : onClose} style={styles.closeBtn} disabled={isLoading}>
                <X color={isLoading ? colors.border : colors.textMuted} size={24} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ flexShrink: 1 }}>
              {errorMsg ? (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{errorMsg}</Text>
                </View>
              ) : null}

              {!isEditMode && (
                <View style={{ gap: 20 }}>
                  {/* Category: Wallet */}
                  <View>
                    <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Wallet</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.optionsList}>
                      {accountOptions
                        .filter((opt) => !opt.isSavings && opt.type !== 'credit_card')
                        .map((opt, idx) => renderOptionButton(opt, idx))}
                      <TouchableOpacity
                        onPress={() => {
                          setIsCreatingCustom(true);
                          setSelectedAccount(null);
                          setCustomCategory('wallet');
                          setName('');
                          setErrorMsg('');
                        }}
                        style={[
                          styles.optionCard,
                          {
                            borderColor: (isCreatingCustom && customCategory === 'wallet') ? colors.primary : colors.border,
                            borderStyle: 'dashed',
                            borderWidth: (isCreatingCustom && customCategory === 'wallet') ? 2.5 : 1.5,
                            backgroundColor: (isCreatingCustom && customCategory === 'wallet') ? `${colors.primary}15` : 'transparent',
                          }
                        ]}
                      >
                        <View style={[styles.iconContainer, { borderColor: (isCreatingCustom && customCategory === 'wallet') ? colors.primary : colors.border, borderWidth: (isCreatingCustom && customCategory === 'wallet') ? 2 : 1.5, backgroundColor: 'rgba(34, 197, 94, 0.1)' }]}>
                          <Plus color={colors.primary} size={24} />
                        </View>
                        <Text style={[styles.optionLabel, { color: colors.text, fontWeight: (isCreatingCustom && customCategory === 'wallet') ? '700' : '500' }]}>Custom</Text>
                      </TouchableOpacity>
                    </ScrollView>
                  </View>

                  {/* Category: Savings */}
                  <View>
                    <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Savings</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.optionsList}>
                      {accountOptions
                        .filter((opt) => opt.isSavings)
                        .map((opt, idx) => renderOptionButton(opt, idx))}
                      <TouchableOpacity
                        onPress={() => {
                          setIsCreatingCustom(true);
                          setSelectedAccount(null);
                          setCustomCategory('savings');
                          setName('');
                          setErrorMsg('');
                        }}
                        style={[
                          styles.optionCard,
                          {
                            borderColor: (isCreatingCustom && customCategory === 'savings') ? colors.primary : colors.border,
                            borderStyle: 'dashed',
                            borderWidth: (isCreatingCustom && customCategory === 'savings') ? 2.5 : 1.5,
                            backgroundColor: (isCreatingCustom && customCategory === 'savings') ? `${colors.primary}15` : 'transparent',
                          }
                        ]}
                      >
                        <View style={[styles.iconContainer, { borderColor: (isCreatingCustom && customCategory === 'savings') ? colors.primary : colors.border, borderWidth: (isCreatingCustom && customCategory === 'savings') ? 2 : 1.5, backgroundColor: 'rgba(34, 197, 94, 0.1)' }]}>
                          <Plus color={colors.primary} size={24} />
                        </View>
                        <Text style={[styles.optionLabel, { color: colors.text, fontWeight: (isCreatingCustom && customCategory === 'savings') ? '700' : '500' }]}>Custom</Text>
                      </TouchableOpacity>
                    </ScrollView>
                  </View>

                  {/* Category: PayLater / Debt */}
                  <View>
                    <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>PayLater / Debt</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.optionsList}>
                      {accountOptions
                        .filter((opt) => opt.type === 'credit_card')
                        .map((opt, idx) => renderOptionButton(opt, idx))}
                      <TouchableOpacity
                        onPress={() => {
                          setIsCreatingCustom(true);
                          setSelectedAccount(null);
                          setCustomCategory('paylater');
                          setName('');
                          setErrorMsg('');
                        }}
                        style={[
                          styles.optionCard,
                          {
                            borderColor: (isCreatingCustom && customCategory === 'paylater') ? colors.primary : colors.border,
                            borderStyle: 'dashed',
                            borderWidth: (isCreatingCustom && customCategory === 'paylater') ? 2.5 : 1.5,
                            backgroundColor: (isCreatingCustom && customCategory === 'paylater') ? `${colors.primary}15` : 'transparent',
                          }
                        ]}
                      >
                        <View style={[styles.iconContainer, { borderColor: (isCreatingCustom && customCategory === 'paylater') ? colors.primary : colors.border, borderWidth: (isCreatingCustom && customCategory === 'paylater') ? 2 : 1.5, backgroundColor: 'rgba(34, 197, 94, 0.1)' }]}>
                          <Plus color={colors.primary} size={24} />
                        </View>
                        <Text style={[styles.optionLabel, { color: colors.text, fontWeight: (isCreatingCustom && customCategory === 'paylater') ? '700' : '500' }]}>Custom</Text>
                      </TouchableOpacity>
                    </ScrollView>
                  </View>
                </View>
              )}

              {/* Custom Wallet Form Sub-View */}
              {isCreatingCustom && !isEditMode && (
                <View style={[styles.customFormContainer, { borderColor: colors.border }]}>
                  <Text style={[styles.formHeader, { color: colors.text }]}>
                    Custom {customCategory === 'wallet' ? 'Wallet' : customCategory === 'savings' ? 'Savings' : 'PayLater'} Details
                  </Text>

                  {/* Account Name */}
                  <View style={styles.inputGroupCompact}>
                    <Text style={[styles.labelCompact, { color: colors.textMuted }]}>Account Name *</Text>
                    <TextInput
                      style={[styles.inputCompact, { color: colors.text, borderColor: colors.border }]}
                      placeholder="e.g. My Cash, Emergency Fund"
                      placeholderTextColor={colors.textMuted}
                      value={name}
                      onChangeText={setName}
                    />
                  </View>

                  {/* Color Picker Swatches */}
                  <View style={styles.inputGroupCompact}>
                    <Text style={[styles.labelCompact, { color: colors.textMuted }]}>Color *</Text>
                    <View style={styles.colorGrid}>
                      {CUSTOM_COLORS.map((c) => (
                        <TouchableOpacity
                          key={c}
                          onPress={() => setCustomColor(c)}
                          style={[styles.colorSwatch, { backgroundColor: c, borderColor: customColor === c ? colors.text : 'transparent' }]}
                        >
                          {customColor === c && <Check color="#fff" size={14} />}
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  {/* Custom Account Type (Only relevant if wallet/savings) */}
                  {customCategory !== 'paylater' && (
                    <View style={styles.inputGroupCompact}>
                      <Text style={[styles.labelCompact, { color: colors.textMuted }]}>Account Type *</Text>
                      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                        {['cash', 'bank', 'e_wallet'].map((t) => (
                          <TouchableOpacity
                            key={t}
                            onPress={() => setCustomType(t as any)}
                            style={[
                              styles.typePillCompact,
                              {
                                borderColor: customType === t ? colors.primary : colors.border,
                                backgroundColor: customType === t ? 'rgba(34, 197, 94, 0.1)' : 'transparent',
                              }
                            ]}
                          >
                            <Text style={{ color: customType === t ? colors.primary : colors.text, fontFamily: 'Manrope_500Medium', fontSize: 12 }}>
                              {t === 'cash' ? 'Cash' : t === 'bank' ? 'Bank' : 'E-Wallet'}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  )}
                </View>
              )}

              {/* Edit Mode inputs */}
              {isEditMode && (
                <View style={{ gap: 16, marginTop: 16 }}>
                  {/* Account Name */}
                  <View style={[styles.inputGroup, { borderBottomColor: colors.border }]}>
                    <Text style={[styles.label, { color: colors.textMuted }]}>Wallet Name</Text>
                    <TextInput
                      style={[styles.input, { color: colors.text, fontSize: 24 }]}
                      placeholder="e.g. BDO Savings"
                      placeholderTextColor={colors.textMuted}
                      value={name}
                      onChangeText={setName}
                    />
                  </View>

                  {/* Account Type selection */}
                  <View style={[styles.inputGroup, { borderBottomColor: colors.border }]}>
                    <Text style={[styles.label, { color: colors.textMuted }]}>Wallet Type</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillScroll}>
                      {['cash', 'bank', 'credit_card', 'e_wallet', 'investment'].map(t => {
                        const isSelected = type === t;
                        return (
                          <TouchableOpacity 
                            key={t} 
                            onPress={() => setType(t)}
                            style={[
                              styles.typePill, 
                              { 
                                borderColor: isSelected ? colors.primary : colors.border,
                                backgroundColor: isSelected ? 'rgba(34, 197, 94, 0.1)' : 'transparent' 
                              }
                            ]}
                          >
                            <Text style={{ 
                              color: isSelected ? colors.primary : colors.text, 
                              fontFamily: 'Manrope_500Medium',
                            }}>
                              {t === 'cash' ? 'Cash' : t === 'bank' ? 'Bank' : t === 'credit_card' ? 'PayLater' : t === 'e_wallet' ? 'E-Wallet' : 'Investment'}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </View>
                </View>
              )}

              {/* Details Fields: Balance / Networth / Interest */}
              {(selectedAccount || (isCreatingCustom && !isEditMode)) && (
                <View style={{ gap: 16, marginTop: 16 }}>
                  {/* Balance / Initial Debt */}
                  <View style={[styles.inputGroup, { borderBottomColor: colors.border }]}>
                    <Text style={[styles.label, { color: colors.textMuted }]}>
                      {(selectedAccount?.type === 'credit_card' || customCategory === 'paylater') ? 'Initial Debt (if any)' : 'Initial Balance (PHP)'}
                    </Text>
                    {(selectedAccount?.type === 'credit_card' || customCategory === 'paylater') && (
                      <Text style={{ fontFamily: 'Manrope_400Regular', color: colors.textMuted, fontSize: 11, marginBottom: 4 }}>
                        Usually leave at 0. Only enter an amount if you already have existing debt to track.
                      </Text>
                    )}
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

                  {/* Net Worth Toggle */}
                  {!(selectedAccount?.type === 'credit_card' || customCategory === 'paylater') && (
                    <TouchableOpacity
                      onPress={() => setIncludeNetworth(!includeNetworth)}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 }}
                    >
                      <View style={[styles.checkbox, { borderColor: colors.border, backgroundColor: includeNetworth ? colors.primary : 'transparent' }]}>
                        {includeNetworth && <Check color="#fff" size={14} />}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontFamily: 'Manrope_500Medium', color: colors.text, fontSize: 14 }}>Include in Total Net Worth</Text>
                        <Text style={{ fontFamily: 'Manrope_400Regular', color: colors.textMuted, fontSize: 11 }}>Uncheck to exclude from total balance on dashboard</Text>
                      </View>
                    </TouchableOpacity>
                  )}

                  {/* Interest Rate */}
                  {((selectedAccount?.isSavings) || (isCreatingCustom && customCategory === 'savings')) && (
                    <View style={[styles.inputGroup, { borderBottomColor: colors.border }]}>
                      <Text style={[styles.label, { color: colors.textMuted }]}>Interest Rate (% per year)</Text>
                      <TextInput
                        style={[styles.input, { color: colors.text }]}
                        keyboardType="decimal-pad"
                        placeholder="0.00"
                        placeholderTextColor={colors.textMuted}
                        value={interestRate}
                        onChangeText={setInterestRate}
                      />
                    </View>
                  )}
                </View>
              )}

              {/* Submit Button */}
              {(selectedAccount || isCreatingCustom || isEditMode) && (
                <TouchableOpacity 
                  style={[styles.submitBtn, { backgroundColor: colors.primary, opacity: isLoading ? 0.7 : 1 }]} 
                  onPress={handleSubmit}
                  disabled={isLoading}
                >
                  {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Save Wallet</Text>}
                </TouchableOpacity>
              )}
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
  sheetContainer: { width: '100%', maxHeight: '90%', flexShrink: 1 },
  sheet: { borderBottomLeftRadius: 0, borderBottomRightRadius: 0, padding: 24, flexShrink: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  title: { fontFamily: 'BricolageGrotesque_700Bold', fontSize: 24 },
  closeBtn: { padding: 4 },
  errorBox: { backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: 12, borderRadius: 8, marginBottom: 16 },
  errorText: { color: '#ef4444', fontFamily: 'Manrope_500Medium', textAlign: 'center', fontSize: 13 },
  sectionTitle: { fontFamily: 'Manrope_500Medium', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 },
  optionsList: { gap: 10, paddingRight: 20 },
  optionCard: { width: 95, height: 105, borderWidth: 1, borderRadius: 16, padding: 10, alignItems: 'center', justifyContent: 'center', gap: 6 },
  iconContainer: { width: 44, height: 44, borderWidth: 1, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  logoImage: { width: 32, height: 32 },
  optionLabel: { fontFamily: 'Manrope_500Medium', fontSize: 11, textAlign: 'center' },
  customFormContainer: { borderWidth: 1, borderRadius: 16, padding: 16, marginTop: 12, gap: 14, backgroundColor: 'rgba(255,255,255,0.02)' },
  formHeader: { fontFamily: 'BricolageGrotesque_700Bold', fontSize: 15 },
  inputGroupCompact: { gap: 6 },
  labelCompact: { fontFamily: 'Manrope_500Medium', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 },
  inputCompact: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14, fontFamily: 'Manrope_400Regular' },
  colorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  colorSwatch: { width: 28, height: 28, borderRadius: 14, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  typePillCompact: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, borderWidth: 1 },
  inputGroup: { borderBottomWidth: 1, paddingBottom: 16, marginBottom: 16 },
  label: { fontFamily: 'Manrope_400Regular', fontSize: 12, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 },
  input: { fontFamily: 'BricolageGrotesque_700Bold', fontSize: 32, padding: 0 },
  pillScroll: { flexDirection: 'row' },
  typePill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 999, borderWidth: 1, marginRight: 8 },
  checkbox: { width: 20, height: 20, borderWidth: 1, borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
  submitBtn: { padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 16 },
  submitText: { fontFamily: 'BricolageGrotesque_700Bold', color: '#fff', fontSize: 18 }
});
