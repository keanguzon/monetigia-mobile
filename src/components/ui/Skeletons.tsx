import React, { useEffect, useRef } from 'react';
import { Animated, View, StyleSheet, ScrollView, ViewStyle, Dimensions, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { GlassCard } from './GlassCard';
import { useTheme } from '../../theme/ThemeProvider';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

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
  const { isDark } = useTheme();
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.timing(animatedValue, {
        toValue: 1,
        duration: 1600,
        useNativeDriver: true,
      })
    );
    animation.start();
    return () => animation.stop();
  }, [animatedValue]);

  const translateX = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [-SCREEN_WIDTH * 0.5, SCREEN_WIDTH * 0.8],
  });

  const baseColor = isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)';
  const highlightColor = isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)';

  return (
    <View
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor: baseColor,
          overflow: 'hidden',
          position: 'relative',
        },
        style,
      ]}
    >
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          {
            transform: [{ translateX }],
            width: SCREEN_WIDTH * 0.5,
          },
        ]}
      >
        <LinearGradient
          colors={['transparent', highlightColor, 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
};

export const DashboardSkeleton: React.FC = () => {
  const { colors } = useTheme();

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} showsVerticalScrollIndicator={false}>
      <View style={styles.content}>
        {/* Screen Title & Date Range selector row */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <Skeleton width={160} height={36} borderRadius={8} />
          <Skeleton width={100} height={32} borderRadius={16} />
        </View>

        {/* Combined Net Worth / Debt Balance Card with Preview */}
        <GlassCard style={{ padding: 20, marginBottom: 16, gap: 16 }}>
          <View>
            <Skeleton width={130} height={14} style={{ marginBottom: 8 }} />
            <Skeleton width={180} height={36} style={{ marginBottom: 8 }} />
            <Skeleton width={200} height={12} />
          </View>
          
          <View style={{ backgroundColor: 'rgba(255, 255, 255, 0.03)', padding: 16, borderRadius: 16, gap: 12 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Skeleton width={100} height={14} />
              <Skeleton width={60} height={16} />
            </View>
            <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center', marginTop: 4 }}>
              <Skeleton width={140} height={32} borderRadius={999} />
            </View>
          </View>
        </GlassCard>

        {/* Income / Expense Grid */}
        <View style={{ flexDirection: 'row', gap: 16, marginBottom: 24 }}>
          <GlassCard style={{ flex: 1, padding: 20 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <View style={{ backgroundColor: 'rgba(34, 197, 94, 0.05)', padding: 8, borderRadius: 9999, marginRight: 8 }}>
                <Skeleton width={16} height={16} borderRadius={8} />
              </View>
              <Skeleton width={50} height={14} />
            </View>
            <Skeleton width={80} height={20} />
          </GlassCard>
          
          <GlassCard style={{ flex: 1, padding: 20 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <View style={{ backgroundColor: 'rgba(239, 68, 68, 0.05)', padding: 8, borderRadius: 9999, marginRight: 8 }}>
                <Skeleton width={16} height={16} borderRadius={8} />
              </View>
              <Skeleton width={50} height={14} />
            </View>
            <Skeleton width={80} height={20} />
          </GlassCard>
        </View>

        {/* Net Savings */}
        <GlassCard style={{ marginBottom: 32, padding: 20 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
            <View style={{ backgroundColor: 'rgba(255, 255, 255, 0.03)', padding: 8, borderRadius: 9999, marginRight: 8 }}>
              <Skeleton width={16} height={16} borderRadius={8} />
            </View>
            <Skeleton width={80} height={14} />
          </View>
          <Skeleton width={100} height={20} />
        </GlassCard>

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
              <View style={{ padding: 12, borderRadius: 9999, marginRight: 16, backgroundColor: 'rgba(255, 255, 255, 0.03)' }}>
                <Skeleton width={20} height={20} borderRadius={10} />
              </View>
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
          <GlassCard key={i} style={{ marginBottom: 12, padding: 20 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                <View style={{ backgroundColor: 'rgba(255, 255, 255, 0.03)', padding: 12, borderRadius: 999, marginRight: 16 }}>
                  <Skeleton width={24} height={24} borderRadius={12} />
                </View>
                <View style={{ flex: 1 }}>
                  <Skeleton width={120} height={18} style={{ marginBottom: 6 }} />
                  <Skeleton width={80} height={14} />
                </View>
              </View>
              <Skeleton width={24} height={24} borderRadius={12} />
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 16 }}>
              <Skeleton width={80} height={14} />
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
        <View style={{ padding: 10, borderRadius: 999, marginRight: 12, backgroundColor: 'rgba(255, 255, 255, 0.03)' }}>
          <Skeleton width={20} height={20} borderRadius={10} />
        </View>
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
