import React from 'react';
import { View, StyleSheet, ViewProps } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../theme/ThemeProvider';

export const AuroraBackground: React.FC<ViewProps> = ({ style, testID, children, ...props }) => {
  const { isDark, colors } = useTheme();

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.background }, style]} testID={testID} {...props}>
      <LinearGradient
        colors={isDark ? ['rgba(16, 185, 129, 0.15)', 'transparent'] : ['rgba(16, 185, 129, 0.1)', 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={isDark ? ['transparent', 'rgba(16, 185, 129, 0.1)'] : ['transparent', 'rgba(16, 185, 129, 0.05)']}
        start={{ x: 1, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {children}
    </View>
  );
};
