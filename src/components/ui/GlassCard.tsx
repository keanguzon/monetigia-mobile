import React from 'react';
import { View, ViewProps } from 'react-native';
import { BlurView } from 'expo-glass-effect';
import { useTheme } from '../../theme/ThemeProvider';

interface GlassCardProps extends ViewProps {
  intensity?: number;
}

export const GlassCard: React.FC<GlassCardProps> = ({ children, intensity = 20, style, ...props }) => {
  const { isDark, colors } = useTheme();

  return (
    <View 
      style={[{ 
        borderRadius: 16, 
        overflow: 'hidden', 
        borderColor: colors.border,
        borderWidth: 1,
        backgroundColor: isDark ? 'rgba(15, 23, 42, 0.6)' : 'rgba(255, 255, 255, 0.6)'
      }, style]} 
      {...props}
    >
      <BlurView intensity={intensity} tint={isDark ? 'dark' : 'light'} style={{ padding: 24 }}>
        {children}
      </BlurView>
    </View>
  );
};
