import React from 'react';
import { View, ViewProps, Platform } from 'react-native';
import { GlassView, GlassStyle } from 'expo-glass-effect';
import { LinearGradient } from 'expo-linear-gradient';
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
      {Platform.OS === 'ios' ? (
        <GlassView 
          glassEffectStyle={glassStyle} 
          colorScheme={isDark ? 'dark' : 'light'} 
          style={{ padding: 24 }}
        >
          {children}
        </GlassView>
      ) : (
        <LinearGradient
          colors={isDark ? ['rgba(255, 255, 255, 0.05)', 'rgba(255, 255, 255, 0.01)'] : ['rgba(255, 255, 255, 0.6)', 'rgba(255, 255, 255, 0.3)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ padding: 24 }}
        >
          {children}
        </LinearGradient>
      )}
    </View>
  );
};
