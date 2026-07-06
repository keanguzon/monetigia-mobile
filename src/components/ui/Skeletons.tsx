import React, { useEffect, useRef } from 'react';
import { Animated, View, StyleSheet, ScrollView, ViewStyle } from 'react-native';
import { GlassCard } from './GlassCard';
import { useTheme } from '../../theme/ThemeProvider';

interface SkeletonProps {
  width?: number | `${number}%` | 'auto';
  height: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%',
  height,
  borderRadius = 8,
  style,
}) => {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.6,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        styles.skeleton,
        {
          width,
          height,
          borderRadius,
          opacity,
        },
        style,
      ]}
    />
  );
};

export const DashboardSkeleton: React.FC = () => {
  const { colors } = useTheme();

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} showsVerticalScrollIndicator={false}>
      <View style={styles.content}>
        {/* Screen Title */}
        <Skeleton width={160} height={36} borderRadius={8} style={{ marginBottom: 24 }} />

        {/* Total Balance Card */}
        <GlassCard style={{ marginBottom: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
            <Skeleton width={20} height={20} borderRadius={10} style={{ marginRight: 8 }} />
            <Skeleton width={100} height={16} />
          </View>
          <Skeleton width={220} height={40} />
        </GlassCard>

        {/* Income / Expense Grid */}
        <View style={{ flexDirection: 'row', gap: 16, marginBottom: 32 }}>
          <GlassCard style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
              <Skeleton width={28} height={28} borderRadius={14} style={{ marginRight: 8 }} />
              <Skeleton width={60} height={16} />
            </View>
            <Skeleton width={100} height={24} />
          </GlassCard>
          <GlassCard style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
              <Skeleton width={28} height={28} borderRadius={14} style={{ marginRight: 8 }} />
              <Skeleton width={60} height={16} />
            </View>
            <Skeleton width={100} height={24} />
          </GlassCard>
        </View>

        {/* Visual Analytics Chart */}
        <View style={{ marginBottom: 32 }}>
          <Skeleton width={120} height={24} style={{ marginBottom: 16 }} />
          <GlassCard style={{ padding: 16, height: 220, justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 16 }}>
              <Skeleton width={60} height={14} />
              <Skeleton width={60} height={14} />
            </View>
            <Skeleton width="100%" height={120} borderRadius={12} />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 10 }}>
              {[1, 2, 3, 4, 5, 6, 7].map((i) => (
                <Skeleton key={i} width={24} height={12} />
              ))}
            </View>
          </GlassCard>
        </View>

        {/* Recent Transactions */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <Skeleton width={180} height={24} />
          <Skeleton width={60} height={16} />
        </View>

        <GlassCard style={{ padding: 0 }}>
          {[1, 2, 3].map((i) => (
            <View
              key={i}
              style={[
                styles.transactionRow,
                i !== 3 ? { borderBottomWidth: 1, borderBottomColor: colors.border } : {}
              ]}
            >
              <Skeleton width={44} height={44} borderRadius={22} style={{ marginRight: 16 }} />
              <View style={{ flex: 1 }}>
                <Skeleton width={120} height={16} style={{ marginBottom: 6 }} />
                <Skeleton width={70} height={12} />
              </View>
              <Skeleton width={80} height={20} />
            </View>
          ))}
        </GlassCard>
      </View>
    </ScrollView>
  );
};

export const AccountsSkeleton: React.FC = () => {
  const { colors } = useTheme();

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} showsVerticalScrollIndicator={false}>
      <View style={styles.content}>
        {/* Screen Title */}
        <Skeleton width={140} height={36} style={{ marginBottom: 24 }} />

        {/* Net Worth Summary */}
        <GlassCard style={{ marginBottom: 24, alignItems: 'center', paddingVertical: 24 }}>
          <Skeleton width={80} height={14} style={{ marginBottom: 8 }} />
          <Skeleton width={180} height={32} />
        </GlassCard>

        {/* Accounts List Header */}
        <Skeleton width={100} height={20} style={{ marginBottom: 16 }} />

        {/* Account Cards */}
        {[1, 2, 3].map((i) => (
          <GlassCard key={i} style={{ marginBottom: 12, padding: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                <Skeleton width={44} height={44} borderRadius={22} style={{ marginRight: 16 }} />
                <View>
                  <Skeleton width={120} height={18} style={{ marginBottom: 6 }} />
                  <Skeleton width={80} height={12} />
                </View>
              </View>
              <Skeleton width={100} height={22} />
            </View>
          </GlassCard>
        ))}
      </View>
    </ScrollView>
  );
};

export const TransactionRowSkeleton: React.FC = () => {
  const { colors } = useTheme();

  return (
    <GlassCard style={styles.cardItemSkeleton}>
      <View style={styles.cardLeft}>
        <Skeleton width={40} height={40} borderRadius={20} style={{ marginRight: 12 }} />
        <View style={{ flex: 1 }}>
          <Skeleton width={140} height={16} style={{ marginBottom: 6 }} />
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <Skeleton width={70} height={12} />
            <Skeleton width={40} height={12} />
          </View>
        </View>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Skeleton width={80} height={18} style={{ marginBottom: 6 }} />
        <Skeleton width={50} height={12} />
      </View>
    </GlassCard>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 24, paddingTop: 64 },
  skeleton: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  transactionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  cardItemSkeleton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 8,
  },
  cardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
});
