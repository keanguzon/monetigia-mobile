import React from 'react';
import { View, StyleSheet, ViewProps, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../theme/ThemeProvider';

export const AuroraBackground: React.FC<ViewProps> = ({ style, testID, children, ...props }) => {
  const { isDark, colors } = useTheme();

  const anim1 = React.useRef(new Animated.Value(0.5)).current;
  const anim2 = React.useRef(new Animated.Value(0.5)).current;

  React.useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim1, { toValue: 1, duration: 4000, useNativeDriver: true }),
        Animated.timing(anim1, { toValue: 0.5, duration: 4000, useNativeDriver: true })
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(anim2, { toValue: 0.5, duration: 3000, useNativeDriver: true }),
        Animated.timing(anim2, { toValue: 1, duration: 3000, useNativeDriver: true })
      ])
    ).start();
  }, []);

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.background }, style]} testID={testID} {...props}>
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: anim1 }]}>
        <LinearGradient
          colors={isDark ? ['rgba(34, 197, 94, 0.15)', 'transparent'] : ['rgba(34, 197, 94, 0.1)', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: anim2 }]}>
        <LinearGradient
          colors={isDark ? ['transparent', 'rgba(34, 197, 94, 0.1)'] : ['transparent', 'rgba(34, 197, 94, 0.05)']}
          start={{ x: 1, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
      {children}
    </View>
  );
};
