import React, { useState, useEffect } from 'react';
import { Modal, View, Text, TouchableOpacity, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform, StyleSheet, DeviceEventEmitter, Alert } from 'react-native';
import { GlassCard } from '../ui/GlassCard';
import { useTheme } from '../../theme/ThemeProvider';
import { getSupabase } from '../../../lib/supabase';
import { useSession } from '../../app/_layout';
import { X } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { EVENTS } from '../../lib/events';

export interface CategoryData {
  id?: string;
  name: string;
  type: string;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  initialData?: CategoryData | null;
}

export const AddCategoryModal: React.FC<Props> = ({ visible, onClose, initialData }) => {
  const { colors } = useTheme();
  const { user } = useSession();

  const [name, setName] = useState('');
  const [type, setType] = useState('expense');
  
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const isEditMode = !!initialData;

  useEffect(() => {
    if (visible) {
      if (initialData) {
        setName(initialData.name);
        setType(initialData.type);
      } else {
        resetForm();
      }
    }
  }, [visible, initialData]);

  const resetForm = () => {
    setName('');
    setType('expense');
    setErrorMsg('');
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setErrorMsg('Name is required');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    if (!user) {
      setErrorMsg('You must be logged in');
      return;
    }

    setIsLoading(true);
    setErrorMsg('');

    try {
      const db = getSupabase();
      
      if (isEditMode && initialData.id) {
        const { error } = await db
          .from('categories')
          .update({
            name: name.trim(),
            type,
          })
          .eq('id', initialData.id)
          .eq('user_id', user.id);

        if (error) throw error;
      } else {
        const { error } = await db.from('categories').insert([
          {
            user_id: user.id,
            name: name.trim(),
            type,
            color: type === 'expense' ? '#ef4444' : type === 'income' ? '#22c55e' : '#3b82f6'
          },
        ]);

        if (error) throw error;
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      DeviceEventEmitter.emit(EVENTS.CATEGORIES_UPDATED);
      onClose();
    } catch (error: any) {
      console.error('Error saving category:', error);
      setErrorMsg(error.message || 'Failed to save category');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView 
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <GlassCard intensity={80} style={styles.card}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text }]}>
              {isEditMode ? 'Edit Category' : 'Add Category'}
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <X color={colors.text} size={24} />
            </TouchableOpacity>
          </View>

          <View style={styles.content}>
            {errorMsg ? (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{errorMsg}</Text>
              </View>
            ) : null}

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.text }]}>Name</Text>
              <TextInput
                style={[
                  styles.input,
                  { 
                    backgroundColor: colors.background, 
                    color: colors.text,
                    borderColor: colors.border
                  }
                ]}
                placeholder="e.g. Groceries"
                placeholderTextColor={colors.textMuted}
                value={name}
                onChangeText={setName}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.text }]}>Type</Text>
              <View style={styles.typeSelector}>
                {['expense', 'income', 'transfer'].map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={[
                      styles.typeOption,
                      { borderColor: colors.border },
                      type === t && { backgroundColor: colors.primary, borderColor: colors.primary }
                    ]}
                    onPress={() => {
                      setType(t);
                      Haptics.selectionAsync();
                    }}
                  >
                    <Text style={[
                      styles.typeText,
                      { color: colors.text },
                      type === t && { color: '#ffffff' }
                    ]}>
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>

          <View style={styles.footer}>
            <TouchableOpacity 
              style={[styles.saveButton, { backgroundColor: colors.primary }]}
              onPress={handleSave}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <Text style={styles.saveButtonText}>
                  {isEditMode ? 'Save Changes' : 'Add Category'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </GlassCard>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    borderRadius: 24,
    overflow: 'hidden',
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(150, 150, 150, 0.2)',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 4,
  },
  content: {
    padding: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    height: 50,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    fontSize: 16,
  },
  typeSelector: {
    flexDirection: 'row',
    gap: 8,
  },
  typeOption: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  typeText: {
    fontSize: 14,
    fontWeight: '600',
  },
  footer: {
    padding: 20,
    paddingTop: 0,
  },
  saveButton: {
    height: 54,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  errorContainer: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 14,
  },
});
