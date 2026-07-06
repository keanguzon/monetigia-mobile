import React from 'react';
import { View, ViewProps } from 'react-native';
import { GlassView, GlassStyle } from 'expo-glass-effect';
import { useTheme } from '../../theme/ThemeProvider';

interface GlassCardProps extends ViewProps {
  glassStyle?: GlassStyle;
}

export const GlassCard: React.FC<GlassCardProps> = ({ children, glassStyle = 'regular', style, ...props }) => {
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
      <GlassView 
        glassEffectStyle={glassStyle} 
        colorScheme={isDark ? 'dark' : 'light'} 
        style={{ padding: 24 }}
      >
        {children}
      </GlassView>
    </View>
  );
};
