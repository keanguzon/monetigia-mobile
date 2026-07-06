import React from 'react';
import { TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { Plus } from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeProvider';
import * as Haptics from 'expo-haptics';

interface FABProps {
  onPress: () => void;
}

const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);

export const FAB: React.FC<FABProps> = ({ onPress }) => {
  const { colors } = useTheme();
  const scaleAnim = React.useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, { toValue: 0.9, useNativeDriver: true }).start();
  };
  const handlePressOut = () => {
    Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }).start();
  };

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };
  return (
    <AnimatedTouchableOpacity
      activeOpacity={0.8}
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[
        styles.fab,
        { backgroundColor: colors.primary, shadowColor: colors.primary, transform: [{ scale: scaleAnim }] }
      ]}
    >
      <Plus color="#ffffff" size={28} strokeWidth={2.5} />
    </AnimatedTouchableOpacity>
  );
};

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    bottom: 90,
    right: 24,
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    zIndex: 100,
  },
});
