import React, { useEffect, useState, useCallback } from "react";
import { View, Text, ScrollView, RefreshControl, ActivityIndicator, TouchableOpacity, Alert, DeviceEventEmitter, StyleSheet } from "react-native";
import { getSupabase } from "../../../lib/supabase";
import { Tags, Plus, ArrowUpRight, ArrowDownLeft, ArrowLeftRight, Trash2, Edit2 } from "lucide-react-native";
import { useSession } from "../_layout";
import { useTheme } from "../../theme/ThemeProvider";
import { GlassCard } from "../../components/ui/GlassCard";
import { AddCategoryModal, CategoryData } from "../../components/categories/AddCategoryModal";
import { EVENTS } from "../../lib/events";
import * as Haptics from "expo-haptics";
import { useFocusEffect } from "expo-router";

export default function CategoriesScreen() {
  const { colors } = useTheme();
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);
  const { user } = useSession();

  const [modalVisible, setModalVisible] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<CategoryData | null>(null);

  const loadCategories = async () => {
    try {
      if (!user) return;
      const { data, error } = await getSupabase()
        .from("categories")
        .select("*")
        .eq("user_id", user.id)
        .order("name", { ascending: true });

      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      console.error("Failed to load categories:", error);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadCategories();
    
    const subscription = DeviceEventEmitter.addListener(EVENTS.CATEGORIES_UPDATED, () => {
      loadCategories();
    });

    return () => {
      subscription.remove();
    };
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      loadCategories();
    }, [user])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadCategories();
  };

  const handleAdd = () => {
    Haptics.selectionAsync();
    setSelectedCategory(null);
    setModalVisible(true);
  };

  const handleEdit = (category: any) => {
    Haptics.selectionAsync();
    setSelectedCategory({
      id: category.id,
      name: category.name,
      type: category.type
    });
    setModalVisible(true);
  };

  const handleDelete = (category: any) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert(
      "Delete Category",
      `Are you sure you want to delete "${category.name}"? Transactions using this category will be preserved but show no category.`,
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete", 
          style: "destructive",
          onPress: async () => {
            try {
              const { error } = await getSupabase()
                .from("categories")
                .delete()
                .eq("id", category.id)
                .eq("user_id", user?.id);
                
              if (error) throw error;
              
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              DeviceEventEmitter.emit(EVENTS.CATEGORIES_UPDATED);
            } catch (err: any) {
              Alert.alert("Error", err.message || "Failed to delete category");
            }
          }
        }
      ]
    );
  };

  const getIconForType = (type: string) => {
    switch (type) {
      case "income": return <ArrowDownLeft color="#22c55e" size={20} />;
      case "expense": return <ArrowUpRight color="#ef4444" size={20} />;
      case "transfer": return <ArrowLeftRight color="#3b82f6" size={20} />;
      default: return <Tags color={colors.textMuted} size={20} />;
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ paddingTop: 60, paddingHorizontal: 20, paddingBottom: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ fontSize: 32, fontWeight: "bold", color: colors.text }}>
          Categories
        </Text>
        <TouchableOpacity 
          onPress={handleAdd} 
          style={{ backgroundColor: colors.primary, padding: 10, borderRadius: 999 }}
        >
          <Plus color="white" size={20} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingTop: 0, paddingBottom: 100 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {isLoading ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
        ) : (
          <GlassCard style={{ padding: 4 }}>
            {categories.length === 0 ? (
              <View style={{ padding: 30, alignItems: 'center' }}>
                <Tags color={colors.textMuted} size={48} opacity={0.5} />
                <Text style={{ color: colors.textMuted, marginTop: 16, textAlign: 'center' }}>
                  No categories found. Create one to organize your transactions.
                </Text>
              </View>
            ) : (
              categories.map((category, index) => (
                <View 
                  key={category.id} 
                  style={[
                    styles.categoryItem, 
                    { borderBottomColor: colors.border },
                    index === categories.length - 1 && { borderBottomWidth: 0 }
                  ]}
                >
                  <View style={styles.categoryLeft}>
                    <View style={[styles.iconContainer, { backgroundColor: colors.background }]}>
                      {getIconForType(category.type)}
                    </View>
                    <View>
                      <Text style={[styles.categoryName, { color: colors.text }]}>{category.name}</Text>
                      <Text style={[styles.categoryType, { color: colors.textMuted }]}>
                        {category.type.charAt(0).toUpperCase() + category.type.slice(1)}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.categoryActions}>
                    <TouchableOpacity onPress={() => handleEdit(category)} style={styles.actionBtn}>
                      <Edit2 color={colors.primary} size={18} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDelete(category)} style={styles.actionBtn}>
                      <Trash2 color="#ef4444" size={18} />
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </GlassCard>
        )}
      </ScrollView>

      <AddCategoryModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        initialData={selectedCategory}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  categoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  categoryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconContainer: {
    padding: 10,
    borderRadius: 12,
  },
  categoryName: {
    fontSize: 16,
    fontWeight: '600',
  },
  categoryType: {
    fontSize: 12,
    marginTop: 2,
  },
  categoryActions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionBtn: {
    padding: 8,
  },
  fab: {
    position: 'absolute',
    bottom: 90,
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8,
  },
});
